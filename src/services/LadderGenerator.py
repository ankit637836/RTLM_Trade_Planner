# src/services/LadderGenerator.py

"""Generate price ladders for entry planning."""

from typing import List
import logging

logger = logging.getLogger(__name__)

class LadderGenerator:
    """Generate price ladder from start to stop with given interval."""
    
    @staticmethod
    def generate(
        start_price: float,
        stop_price: float,
        interval: float,
        direction: str = "BUY"
    ) -> List[float]:
        """
        Generate ladder levels.
        
        Args:
            start_price: Entry level
            stop_price: Stop loss level
            interval: Price step between levels
            direction: "BUY" or "SELL"
            
        Returns:
            List of prices from start toward stop
            
        Raises:
            ValueError: If parameters invalid
        """
        if interval <= 0:
            raise ValueError(f"Interval must be positive, got {interval}")
        
        if direction == "BUY":
            if start_price <= stop_price:
                raise ValueError(f"For BUY, startPrice ({start_price}) must be > stopPrice ({stop_price})")
            
            # Generate downward from start to stop
            ladder = []
            price = start_price
            while price >= stop_price - 1e-9:  # Account for floating point precision
                ladder.append(round(price, 4))  # Round to 4 decimals
                price -= interval
            
            logger.debug(f"Generated {len(ladder)} levels for BUY ladder")
            return ladder
        
        elif direction == "SELL":
            if start_price >= stop_price:
                raise ValueError(f"For SELL, startPrice ({start_price}) must be < stopPrice ({stop_price})")
            
            # Generate upward from start to stop
            ladder = []
            price = start_price
            while price <= stop_price + 1e-9:  # Account for floating point precision
                ladder.append(round(price, 4))
                price += interval
            
            logger.debug(f"Generated {len(ladder)} levels for SELL ladder")
            return ladder
        
        else:
            raise ValueError(f"Direction must be BUY or SELL, got {direction}")
