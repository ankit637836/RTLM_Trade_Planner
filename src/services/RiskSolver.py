# src/services/RiskSolver.py

"""Core computation engine for RTLM Futures lot allocations."""

import math
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class RiskSolver:
    """Calculates integer lot allocations based on risk parameters."""
    
    def __init__(self, 
                 direction: str,
                 tick_size: float,
                 usd_tick_value: float,
                 ladder: List[float], 
                 stop_price: float, 
                 tp_price: float, 
                 target_risk: float):
        self.direction = direction.upper()
        self.tick_size = tick_size
        self.usd_tick_value = usd_tick_value
        self.ladder = ladder
        self.stop_price = stop_price
        self.tp_price = tp_price
        self.target_risk = target_risk
        
        # Precompute per-level risk and reward
        self.risk_per_lot = []
        self.reward_per_lot = []
        
        for price in ladder:
            ticks_to_stop = abs(price - stop_price) / tick_size
            # For BUY, TP is above entry (tp - price). For SELL, TP is below entry (price - tp).
            ticks_to_tp = abs(tp_price - price) / tick_size
            
            self.risk_per_lot.append(ticks_to_stop * usd_tick_value)
            self.reward_per_lot.append(ticks_to_tp * usd_tick_value)

    def _equal_weights(self, n: int) -> List[int]:
        return [1] * n

    def _front_weights(self, n: int) -> List[int]:
        return [max(1, 6 - i) for i in range(n)]

    def _back_weights(self, n: int) -> List[int]:
        return [min(5, i + 1) for i in range(n)]

    def _solve_integer_lots(self, weights: List[int]) -> List[int]:
        total_risk_1_lot = sum(w * r for w, r in zip(weights, self.risk_per_lot))
        if total_risk_1_lot <= 0:
            return [0] * len(weights)
            
        base_mult = self.target_risk / total_risk_1_lot
        best_lots = [0] * len(weights)
        min_err = float('inf')
        
        # Test multipliers using error-diffusion for tight integer rounding
        step = max(base_mult * 0.02, 0.001)
        m = base_mult * 0.5
        while m <= base_mult * 1.5:
            float_lots = [w * m for w in weights]
            test_lots = []
            running_err = 0.0
            for f in float_lots:
                target = f + running_err
                rounded = round(target)
                test_lots.append(rounded)
                running_err = target - rounded
                
            tr = sum(l * r for l, r in zip(test_lots, self.risk_per_lot))
            err = abs(tr - self.target_risk)
            if err < min_err:
                min_err = err
                best_lots = test_lots
            m += step
            
        return best_lots

    def compute_model(self, model_id: str, title: str, subtitle: str,
                     manual_lots: Optional[List[int]] = None,
                     base_shape: Optional[str] = None) -> Dict:
        n = len(self.ladder)
        
        if model_id == "manual" and manual_lots is not None and len(manual_lots) == n:
            lots = manual_lots.copy()
        elif manual_lots is not None and len(manual_lots) == n:
            lots = manual_lots.copy()
        else:
            shape_to_use = (base_shape if base_shape else model_id).lower()
            if shape_to_use == "equal":
                weights = self._equal_weights(n)
            elif shape_to_use == "front_loaded":
                weights = self._front_weights(n)
            elif shape_to_use == "back_loaded":
                weights = self._back_weights(n)
            else:
                weights = self._equal_weights(n)

            lots = self._solve_integer_lots(weights)

        total_lots = sum(lots)
        total_risk = sum(l * r for l, r in zip(lots, self.risk_per_lot))
        total_reward = sum(l * r for l, r in zip(lots, self.reward_per_lot))
        avg_entry = sum(l * p for l, p in zip(lots, self.ladder)) / total_lots if total_lots > 0 else 0
        dev_pct = ((total_risk - self.target_risk) / self.target_risk * 100) if self.target_risk > 0 else 0
        rr_ratio = (total_reward / total_risk) if total_risk > 0 else 0
        
        return {
            "model_id": model_id,
            "title": title,
            "subtitle": subtitle,
            "lots": lots,
            "ladder": self.ladder,
            # Bounds this model was solved against (RAEM uses its own, market-derived
            # bounds — the UI must render each model against these, not the form inputs)
            "stop_price": self.stop_price,
            "tp_price": self.tp_price,
            "total_lots": total_lots,
            "total_risk": total_risk,
            "total_reward": total_reward,
            "avg_entry": avg_entry,
            "deviation_pct": dev_pct,
            "rr_ratio": rr_ratio,
            "risk_per_lot": self.risk_per_lot,
            "reward_per_lot": self.reward_per_lot
        }