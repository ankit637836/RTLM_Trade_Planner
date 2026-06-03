# src/config/settings.py

"""Load configuration from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
QH_API_TOKEN = os.getenv("QH_API_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///rtlm.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY not set in .env")

if not QH_API_TOKEN:
    raise ValueError("QH_API_TOKEN not set in .env")
