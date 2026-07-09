# src/config/constants.py

"""Contract specifications and fixed constants."""



# Solver modes (EXACT_RISK is the only supported mode)
SOLVER_MODES = ["EXACT_RISK"]
DIRECTIONS = ["BUY", "SELL"]
VOLATILITY_LEVELS = ["LOW", "MED", "HIGH"]

# Interval calculation (volatility factor mapping based on ticks)
# LOW = 1x tick, MED = 2x tick, HIGH = 4x tick (handled by frontend, backend receives actual interval)

# QH API Configuration
QH_API_BASE_URL = "https://qh-api.corp.hertshtengroup.com"
QH_API_RATE_LIMIT = 50  # requests per minute

# Anthropic Claude Configuration
CLAUDE_MODEL = "claude-sonnet-4-20250514"
CLAUDE_MAX_TOKENS = 1000
