import numpy as np
import pandas as pd
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

class RegimeAnalyzer:
    @staticmethod
    def calculate_hurst_exponent(ts: np.ndarray, max_lags: int = 20) -> float:
        """
        Calculate Hurst Exponent using variance of log returns over different lags.
        H < 0.5: Mean Reverting
        H = 0.5: Random Walk
        H > 0.5: Trending
        """
        if len(ts) < max_lags * 2:
            max_lags = max(2, len(ts) // 2)
            
        if max_lags < 2:
            return 0.5 # Default to random walk if not enough data
            
        lags = range(2, max_lags)
        try:
            # Calculate the variance of the differences at each lag
            tau_var = [np.var(ts[lag:] - ts[:-lag]) for lag in lags]
            # Fit a line to log(var) vs log(lag)
            m = np.polyfit(np.log(list(lags)), np.log(tau_var), 1)
            # The slope is approximately 2H
            hurst = m[0] / 2.0
            return max(0.0, min(1.0, hurst))
        except Exception as e:
            logger.error(f"Error calculating Hurst Exponent: {e}")
            return 0.5
            
    @staticmethod
    def generate_suggestion(ohlc_list: List[Dict], tick_size: float = 0.005, is_sofr_derivative: bool = False) -> Dict:
        """
        Generates RAEM suggestion payload from OHLC data
        """
        if not ohlc_list or len(ohlc_list) < 5:
            return {"status": "error", "message": "Not enough data for analysis (minimum 5 periods required)."}
            
        try:
            df = pd.DataFrame(ohlc_list)
            df['close'] = df['close'].astype(float)
            df['high'] = df['high'].astype(float)
            df['low'] = df['low'].astype(float)
            
            # 1. Hurst Exponent
            # Drop the first row (used for TR) so we calculate STD, Mean, and Hurst purely on the exact lookback window
            valid_closes = df['close'].iloc[1:] if len(df) > 1 else df['close']
            hurst = RegimeAnalyzer.calculate_hurst_exponent(valid_closes.values)
            
            # 2. ATR / STD
            df['prev_close'] = df['close'].shift(1)
            df['tr'] = np.maximum(df['high'] - df['low'], 
                                 np.maximum(abs(df['high'] - df['prev_close']), 
                                            abs(df['low'] - df['prev_close'])))
            atr = df['tr'].mean()
            
            # Drop the first row (used for TR) so we calculate STD and Mean purely on the exact lookback window
            valid_closes = df['close'].iloc[1:] if len(df) > 1 else df['close']
            std = valid_closes.std()
            
            # ATR/STD component: High = Mean Reverting, Low = Trending
            # Typical ATR/STD is around 1.0. If ATR > 1.5 * STD, heavily mean reverting.
            atr_std_ratio = atr / std if std > 0 else 1.0
            
            # 3. Z-Score (Current close vs mean)
            mean_close = valid_closes.mean()
            z_score = (df['close'].iloc[-1] - mean_close) / std if std > 0 else 0.0
            
            # Normalize Hurst (0 to 1) -> Mean Reverting (1) to Trending (0)
            # Hurst < 0.5 is Mean Reverting, so we invert it for the RS score.
            hurst_component = max(0.0, min(1.0, 1.0 - hurst)) 
            
            # Normalize ATR/STD (0 to 1)
            # Let's say ratio of 0.5 is 0.0 (trending), ratio of 2.0 is 1.0 (mean reverting)
            atr_std_component = max(0.0, min(1.0, (atr_std_ratio - 0.5) / 1.5))
            
            # Normalize Z-Score extension
            # High Z-Score absolute means exhaustion -> Mean Reverting (1.0)
            extension_component = max(0.0, min(1.0, abs(z_score) / 3.0))
            
            # Composite Regime Score (RS)
            rs = (0.45 * hurst_component) + (0.35 * atr_std_component) + (0.20 * extension_component)
            
            # Determine Model
            if rs < 0.40:
                suggested_model = 'FRONT_LOADED'
            elif rs > 0.60:
                suggested_model = 'BACK_LOADED'
            else:
                suggested_model = 'EQUAL'
                
            # Determine EME (Expected Maximum Excursion) & Spacing
            # We use average high-low range over the period
            avg_hl_range = (df['high'] - df['low']).mean()
            
            # If trending (low RS), we expect smaller counter-trend pullbacks -> tighter EME
            # If mean-reverting (high RS), we expect full range sweeps -> wider EME
            vol_multiplier = 0.5 + rs # Scales from 0.5 to 1.5
            eme_price = avg_hl_range * vol_multiplier
            
            eme_ticks = int(eme_price / tick_size) if tick_size > 0 else 10
            eme_ticks = max(4, min(eme_ticks, 200)) # Clamp between 4 and 200 ticks
            
            # Start Price Logic (Z-Score based)
            current_price = df['close'].iloc[-1]
            if rs > 0.60:
                start_anchor_z = -1.0 # Wait for a deep pullback
            elif rs < 0.40:
                start_anchor_z = -0.2 # Enter immediately or on shallow pullback
            else:
                start_anchor_z = -0.5
                
            # Net change across the lookback window (first close of the window vs last)
            bps_change = float(valid_closes.iloc[-1] - valid_closes.iloc[0])
            if not is_sofr_derivative:
                bps_change *= 100.0

            return {
                "status": "success",
                "regime_score": round(rs, 3),
                "suggested_model": suggested_model,
                "eme_ticks": eme_ticks,
                "start_anchor_z": start_anchor_z,
                "last_close": float(current_price),
                "metrics": {
                    "hurst": round(hurst, 3),
                    "atr_std_ratio": round(atr_std_ratio, 3),
                    "z_score": round(z_score, 3),
                    "atr": round(atr, 5),
                    "std": round(std, 5),
                    "bps_change": round(bps_change, 4)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate RAEM suggestion: {e}")
            return {"status": "error", "message": str(e)}
