# src/models/__init__.py

from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Direction(str, Enum):
    """Trade direction."""
    BUY = "BUY"
    SELL = "SELL"

class SolverMode(str, Enum):
    """Risk solver mode."""
    EXACT_RISK = "EXACT_RISK"

@dataclass
class RiskSolverInput:
    """Input parameters for risk solver."""
    direction: Direction
    product: str  # e.g., "SR3", "ZQ"
    startPrice: float
    stopPrice: float
    tpPrice: float
    targetRisk: float
    tolerance: float  # e.g., 0.05 for ±5%
    interval: float
    solverMode: SolverMode

@dataclass
class LadderLevel:
    """One level in the entry ladder."""
    price: float
    lots: int
    riskPerLot: float
    rewardPerLot: Optional[float] = None

@dataclass
class RiskSolverOutput:
    """Output from risk solver."""
    ladder: List[float]
    lots: List[int]
    avgEntry: float
    totalLots: int
    totalRisk: float
    totalReward: float
    riskRewardRatio: float
    
    @property
    def orderPlan(self) -> List[tuple]:
        """Return list of (direction, lots, price) tuples."""
        return list(zip(self.ladder, self.lots))
