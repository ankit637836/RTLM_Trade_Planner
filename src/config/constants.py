# src/config/constants.py

"""Contract specifications and fixed constants."""

from dataclasses import dataclass
from typing import Dict

@dataclass
class ContractSpec:
    """Specification for a STIR futures contract."""
    code: str
    name: str
    exchange: str
    tickSize: float
    usdTickValue: float
    currency: str
    
# All 6 supported contracts
CONTRACTS: Dict[str, ContractSpec] = {
    "SR3": ContractSpec(
        code="SR3",
        name="3M SOFR",
        exchange="CME",
        tickSize=0.005,
        usdTickValue=12.50,
        currency="USD"
    ),
    "SR1": ContractSpec(
        code="SR1",
        name="1M SOFR",
        exchange="CME",
        tickSize=0.005,
        usdTickValue=12.50,
        currency="USD"
    ),
    "ZQ": ContractSpec(
        code="ZQ",
        name="Fed Funds",
        exchange="CBOT",
        tickSize=0.005,
        usdTickValue=20.835,
        currency="USD"
    ),
    "I": ContractSpec(
        code="I",
        name="Euribor",
        exchange="ICE",
        tickSize=0.005,
        usdTickValue=12.50,
        currency="EUR"
    ),
    "SO3": ContractSpec(
        code="SO3",
        name="3M SONIA",
        exchange="ICE",
        tickSize=0.005,
        usdTickValue=12.50,
        currency="GBP"
    ),
    "SA3": ContractSpec(
        code="SA3",
        name="3M SARON",
        exchange="ICE",
        tickSize=0.005,
        usdTickValue=12.50,
        currency="CHF"
    ),
}

# FX Rates (static, to be replaced with live data in Phase 3)
FX_RATES: Dict[str, float] = {
    "EUR": 1.154,
    "GBP": 1.323,
    "CHF": 1.252,
    "USD": 1.000,
}

# Solver modes
SOLVER_MODES = ["EXACT_RISK", "BEST_RR"]
DIRECTIONS = ["BUY", "SELL"]
VOLATILITY_LEVELS = ["LOW", "MED", "HIGH"]

# Interval calculation (volatility factor)
VOLATILITY_FACTORS = {
    "LOW": 0.5,
    "MED": 1.0,
    "HIGH": 1.5,
}

# QH API Configuration
QH_API_BASE_URL = "https://qh-api.corp.hertshtengroup.com"
QH_API_RATE_LIMIT = 50  # requests per minute

# Anthropic Claude Configuration
CLAUDE_MODEL = "claude-sonnet-4-20250514"
CLAUDE_MAX_TOKENS = 1000
