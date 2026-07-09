# src/config/settings.py

"""Load configuration from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
QH_API_TOKEN = os.getenv("QH_API_TOKEN", "")
# PostgreSQL is the only supported database (JSONB columns + ON CONFLICT upserts).
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. DevOps must inject this!")
LOG_LEVEL_STR = os.getenv("LOG_LEVEL", "INFO").upper()

import logging
LOG_LEVEL = getattr(logging, LOG_LEVEL_STR, logging.INFO)

if not ANTHROPIC_API_KEY:
    logging.warning("ANTHROPIC_API_KEY not set in environment.")

if not QH_API_TOKEN:
    logging.warning("QH_API_TOKEN not set in environment.")
