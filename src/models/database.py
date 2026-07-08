# src/models/database.py

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, BigInteger, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set. DevOps must inject this!")

# Create engine
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Product(Base):
    """STIR products (SR3, ZQ, I, SO3, SA3, SR1)"""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)  # SR3, ZQ, etc.
    name = Column(String(100), nullable=False)  # 3M SOFR, Fed Funds, etc.
    qh_prefix = Column(String(10), nullable=False)  # SRA, FF, ER, etc.
    exchange = Column(String(50))
    tick_size = Column(Numeric(10, 6))
    usd_tick_value = Column(Numeric(10, 2))
    currency = Column(String(3))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    instruments = relationship("Instrument", back_populates="product", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Product {self.code}: {self.name}>"


class Instrument(Base):
    """Instruments: outrights, calendars, flies"""
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)
    instrument_code = Column(String(50), unique=True, nullable=False)  # SRAM26, SRAH26-M26, etc.
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    instrument_type = Column(String(20))  # 'outright', 'calendar', 'fly', 'dfly'
    legs = Column(Integer)  # 1, 2, 3, 4
    month_letters = Column(String(10))  # H, M, U, Z (combined)
    year = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product", back_populates="instruments")
    ohlc_data = relationship("OHLCData", back_populates="instrument", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Instrument {self.instrument_code}>"


class OHLCData(Base):
    """OHLC price data"""
    __tablename__ = "ohlc_data"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    open_price = Column(Numeric(15, 6))
    high_price = Column(Numeric(15, 6))
    low_price = Column(Numeric(15, 6))
    close_price = Column(Numeric(15, 6))
    volume = Column(BigInteger)
    qh_timestamp = Column(BigInteger)  # Milliseconds from QuantHub
    fetch_timestamp = Column(DateTime, default=datetime.utcnow)
    interval = Column(String(10), default='1D')
    is_latest = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint('instrument_id', 'qh_timestamp', 'interval', name='uix_ohlc_instrument_time_interval'),
    )

    # Relationships
    instrument = relationship("Instrument", back_populates="ohlc_data")

    def __repr__(self):
        return f"<OHLCData {self.instrument_id}: {self.close_price}>"


class CacheMetadata(Base):
    """Metadata about cache status"""
    __tablename__ = "cache_metadata"

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String(100), unique=True, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow)
    expiration_minutes = Column(Integer, default=1440)
    data_count = Column(Integer)
    status = Column(String(20))  # 'fresh', 'stale', 'expired'

    def __repr__(self):
        return f"<CacheMetadata {self.cache_key}: {self.status}>"


class MarketMetric(Base):
    """Calculated market metrics (Volatility, RVOL, etc)"""
    __tablename__ = "market_metrics"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    metric_name = Column(String(50), nullable=False)
    metric_value = Column(Numeric(15, 6))
    period = Column(String(20))
    calc_timestamp = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<MarketMetric {self.metric_name}: {self.metric_value}>"


class UserTemplate(Base):
    """Saved user configurations for planners"""
    __tablename__ = "user_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    template_type = Column(String(20), nullable=False)  # 'ENTRY' or 'EXIT'
    payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<UserTemplate {self.name} ({self.template_type})>"


class SimSession(Base):
    """Saved simulator sessions"""
    __tablename__ = "sim_sessions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    state_payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SimSession {self.name}>"


# Create all tables
def init_db():
    """Initialize database"""
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialized")


# Session dependency
def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()