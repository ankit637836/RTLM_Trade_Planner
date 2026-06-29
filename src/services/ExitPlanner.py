"""
src/services/ExitPlanner.py - Complete Exit Planning Service
Implements two exit strategies:
1. DIRECT TARGET: Hold all lots to TP
2. RANGE TRADER: Market-make bands while drifting to TP
"""

import math
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass


@dataclass
class RTBand:
    """Range trader band data"""
    id: int
    sell_level: float
    buy_level: float
    trips: int = 0
    pnl: float = 0.0


class ExitPlanner:
    """
    Exit planning for futures trading
    Calculates P&L for direct exits and range trader simulation
    """
    
    def __init__(self, direction: str, tick_size: float, usd_tick_value: float):
        """
        Initialize ExitPlanner
        
        Args:
            direction: 'Buy' or 'Sell'
            tick_size: Tick size for contract (e.g., 0.005)
            usd_tick_value: USD value per tick (e.g., 12.5)
        """
        self.direction = direction
        self.is_buy = direction.lower() == 'buy'
        self.tick_size = tick_size
        self.usd_tick_value = usd_tick_value
    
    # ========================================================================
    # DIRECT EXIT METHOD
    # ========================================================================
    
    def calculate_direct_exit(self, total_lots: int, avg_entry: float,
                            stop_price: float, tp_price: float) -> Dict:
        """
        Calculate direct exit P&L (hold all lots to TP)
        
        Args:
            total_lots: Total number of contracts
            avg_entry: Average entry price
            stop_price: Stop loss price
            tp_price: Take profit price
        
        Returns:
            Dictionary with P&L calculations
        """
        if total_lots == 0 or not self._is_valid_price(avg_entry):
            return {
                'status': 'error',
                'message': 'Invalid inputs',
                'total_lots': total_lots,
                'avg_entry': avg_entry,
            }
        
        if not self._is_valid_price(tp_price):
            return {
                'status': 'error',
                'message': 'Invalid TP price',
                'tp_price': tp_price,
            }
        
        # Calculate P&L at TP
        ticks_to_tp = (tp_price - avg_entry) / self.tick_size
        pnl_at_tp = total_lots * ticks_to_tp * self.usd_tick_value
        
        # Calculate P&L at SL (loss)
        ticks_to_sl = (stop_price - avg_entry) / self.tick_size
        pnl_at_sl = total_lots * ticks_to_sl * self.usd_tick_value
        
        # Calculate R/R ratio
        if pnl_at_sl < 0:
            rr_ratio = pnl_at_tp / abs(pnl_at_sl)
        else:
            rr_ratio = 0.0
        
        return {
            'status': 'success',
            'method': 'direct',
            'total_lots': total_lots,
            'avg_entry': round(avg_entry, 6),
            'tp_price': round(tp_price, 6),
            'stop_price': round(stop_price, 6),
            'ticks_to_tp': round(ticks_to_tp, 4),
            'ticks_to_sl': round(ticks_to_sl, 4),
            'pnl_at_tp': round(pnl_at_tp, 2),
            'pnl_at_sl': round(pnl_at_sl, 2),
            'rr_ratio': round(rr_ratio, 2) if rr_ratio > 0 else 0,
        }
    
    # ========================================================================
    # RANGE TRADER EXIT METHOD
    # ========================================================================
    
    def build_rt_bands(self, start_price: float, tp_price: float,
                      rt_spacing_ticks: int) -> List[RTBand]:
        """
        Build range trader bands between start_price and TP
        
        Band structure for LONG:
        - Entry: avg_entry
        - Sell/Buy 1: avg_entry + spacing
        - Sell/Buy 2: avg_entry + spacing*2
        - ... continue until TP
        
        Args:
            start_price: The price to start building bands from
            tp_price: Take profit price
            rt_spacing_ticks: Spacing between bands in ticks
        
        Returns:
            List of RTBand objects
        """
        spacing = rt_spacing_ticks * self.tick_size
        direction_mult = 1 if self.is_buy else -1
        
        bands = []
        current_price = start_price + direction_mult * spacing
        band_id = 1
        
        max_bands = 200
        while band_id <= max_bands:
            # Check if we've passed TP
            past_tp = (current_price >= tp_price) if self.is_buy else (current_price <= tp_price)
            if past_tp:
                break
            
            sell_level = self._round_price(current_price)
            buy_level = self._round_price(current_price - direction_mult * spacing)
            
            bands.append(RTBand(
                id=band_id,
                sell_level=sell_level,
                buy_level=buy_level
            ))
            
            current_price = self._round_price(current_price + direction_mult * spacing)
            band_id += 1
        
        return bands
    
    def simulate_range_trader_exit(self, total_lots: int, avg_entry: float,
                                  stop_price: float, tp_price: float,
                                  rt_spacing_ticks: int, rt_lots_per_band: int,
                                  crossing_override: Optional[int] = None,
                                  rt_start_price: Optional[float] = None) -> Dict:
        """
        Simulate range trader exit strategy
        
        Strategy:
        1. Build bands at regular intervals from avg_entry to TP
        2. Market-make each band: sell at top, buy back at bottom
        3. Each round trip = rt_lots * spacing * usd_tick_value profit
        4. Continue making round trips until reaching TP
        5. Exit remaining lots at TP
        
        Args:
            total_lots: Total entry lots
            avg_entry: Average entry price
            stop_price: Stop loss price
            tp_price: Take profit price
            rt_spacing_ticks: Spacing between bands (in ticks)
            rt_lots_per_band: Lots to trade per band cycle
            crossing_override: Override for total crossings (optional)
        
        Returns:
            Dictionary with RT simulation results
        """
        if total_lots == 0 or not self._is_valid_price(avg_entry):
            return {
                'status': 'error',
                'message': 'Invalid inputs',
            }
        
        # Build bands
        band_start = rt_start_price if rt_start_price is not None else avg_entry
        bands = self.build_rt_bands(band_start, tp_price, rt_spacing_ticks)
        
        if not bands:
            return {
                'status': 'error',
                'message': 'No bands could be built',
                'bands': [],
            }
        
        # Calculate P&L per round trip
        pnl_per_rt = rt_lots_per_band * rt_spacing_ticks * self.usd_tick_value
        
        # Distribute crossings across bands
        if crossing_override is not None:
            total_trips = max(0, int(crossing_override))
            trips_per_band = total_trips / len(bands) if bands else 0
        else:
            # Default: 3 crossings per band
            total_trips = len(bands) * 3
            trips_per_band = 3
        
        # Assign trips to each band
        band_data = []
        total_rt_pnl = 0.0
        
        for i, band in enumerate(bands):
            if crossing_override is not None:
                # Distribute trips proportionally
                remainder = total_trips % len(bands)
                if i < remainder:
                    trips = math.ceil(trips_per_band)
                else:
                    trips = math.floor(trips_per_band)
                trips = max(0, int(trips))
            else:
                trips = 3
            
            pnl = trips * pnl_per_rt
            total_rt_pnl += pnl
            
            band_data.append({
                'id': band.id,
                'sell_level': round(band.sell_level, 6),
                'buy_level': round(band.buy_level, 6),
                'trips': trips,
                'pnl': round(pnl, 2),
            })
        
        # Calculate core exit P&L (direct from avg_entry to TP)
        ticks_entry_to_tp = (tp_price - avg_entry) / self.tick_size
        core_pnl = total_lots * ticks_entry_to_tp * self.usd_tick_value
        
        # Calculate total P&L
        total_pnl = total_rt_pnl + core_pnl
        
        # Calculate stop loss
        ticks_entry_to_sl = (stop_price - avg_entry) / self.tick_size
        stop_loss = total_lots * ticks_entry_to_sl * self.usd_tick_value
        
        # Calculate breakeven trips
        if pnl_per_rt > 0:
            breakeven_trips = math.ceil(abs(stop_loss) / pnl_per_rt)
        else:
            breakeven_trips = None
        
        return {
            'status': 'success',
            'method': 'range_trader',
            'total_lots': total_lots,
            'avg_entry': round(avg_entry, 6),
            'tp_price': round(tp_price, 6),
            'stop_price': round(stop_price, 6),
            'rt_spacing_ticks': rt_spacing_ticks,
            'rt_lots_per_band': rt_lots_per_band,
            'bands': band_data,
            'pnl_per_rt': round(pnl_per_rt, 2),
            'total_rt_pnl': round(total_rt_pnl, 2),
            'core_pnl': round(core_pnl, 2),
            'total_pnl': round(total_pnl, 2),
            'stop_loss': round(stop_loss, 2),
            'rt_uplift': round(total_rt_pnl, 2),
            'breakeven_trips': breakeven_trips,
            'num_bands': len(bands),
        }
    
    # ========================================================================
    # MULTI-MODEL EXIT CALCULATION
    # ========================================================================
    
    def calculate_exit_for_all_models(self, models: List[Dict],
                                     stop_price: float, tp_price: float,
                                     exit_mode: str = 'direct',
                                     rt_spacing_ticks: int = 10,
                                     rt_lots_per_band: int = 1,
                                     crossing_override: Optional[int] = None,
                                     rt_start_price: Optional[float] = None) -> Dict[str, Dict]:
        """
        Calculate exit for all 4 entry models
        
        Args:
            models: List of model results from RiskSolver
                   Each should have: name, lots[], ladder[], total_lots, avg_entry
            stop_price: Stop loss price
            tp_price: Take profit price
            exit_mode: 'direct' or 'range_trader'
            rt_spacing_ticks: Range trader spacing
            rt_lots_per_band: Range trader lots per band
            crossing_override: Override for total RT crossings
        
        Returns:
            Dictionary with exit calculations for each model
        """
        results = {}
        
        for model in models:
            model_name = model.get('model_id', 'unknown')
            total_lots = model.get('total_lots', 0)
            avg_entry = model.get('avg_entry')
            
            if exit_mode == 'direct':
                exit_result = self.calculate_direct_exit(
                    total_lots, avg_entry, stop_price, tp_price
                )
            else:  # range_trader
                exit_result = self.simulate_range_trader_exit(
                    total_lots, avg_entry, stop_price, tp_price,
                    rt_spacing_ticks, rt_lots_per_band, crossing_override
                )
            
            # Add model name to result
            exit_result['model_id'] = model_name
            results[model_name] = exit_result
        
        return results
    
    # ========================================================================
    # UTILITY FUNCTIONS
    # ========================================================================
    
    @staticmethod
    def _is_valid_price(price) -> bool:
        """Check if price is a valid float"""
        try:
            return isinstance(price, (int, float)) and math.isfinite(float(price))
        except (TypeError, ValueError):
            return False
    
    @staticmethod
    def _round_price(price: float) -> float:
        """Round price to 8 decimal places"""
        return round(price * 1e8) / 1e8


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Example: SR3 contract, long 66 lots from 99.5683 with 1513 target risk
    
    exit_planner = ExitPlanner(
        direction='Buy',
        tick_size=0.005,
        usd_tick_value=12.5
    )
    
    # Direct exit
    direct_result = exit_planner.calculate_direct_exit(
        total_lots=66,
        avg_entry=99.5683,
        stop_price=99.5000,
        tp_price=100.0400
    )
    print("DIRECT EXIT:")
    print(direct_result)
    print()
    
    # Range trader exit
    rt_result = exit_planner.simulate_range_trader_exit(
        total_lots=66,
        avg_entry=99.5683,
        stop_price=99.5000,
        tp_price=100.0400,
        rt_spacing_ticks=5,
        rt_lots_per_band=2
    )
    print("RANGE TRADER EXIT:")
    print(rt_result)
    print()
    
    # Show bands
    if 'bands' in rt_result:
        print("BANDS:")
        for band in rt_result['bands']:
            print(f"  Band {band['id']}: Sell {band['sell_level']:.4f}, "
                  f"Buy {band['buy_level']:.4f}, Trips {band['trips']}, P&L ${band['pnl']}")