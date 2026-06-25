-- src/database/schema.sql

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    qh_prefix VARCHAR(10) NOT NULL,
    exchange VARCHAR(50),
    tick_size DECIMAL(10, 6),
    usd_tick_value DECIMAL(10, 2),
    currency VARCHAR(3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Instruments table (outrights, calendars, flies, etc.)
CREATE TABLE IF NOT EXISTS instruments (
    id SERIAL PRIMARY KEY,
    instrument_code VARCHAR(50) UNIQUE NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    instrument_type VARCHAR(20), -- 'outright', 'calendar', 'fly', 'dfly'
    legs INTEGER, -- 1 for outright, 2 for calendar, 3 for fly, 4 for dfly
    month_letters VARCHAR(10), -- 'H', 'M', 'U', 'Z', etc.
    year INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- OHLC data table
CREATE TABLE IF NOT EXISTS ohlc_data (
    id SERIAL PRIMARY KEY,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id),
    open_price DECIMAL(15, 6),
    high_price DECIMAL(15, 6),
    low_price DECIMAL(15, 6),
    close_price DECIMAL(15, 6),
    volume BIGINT,
    qh_timestamp BIGINT, -- milliseconds from QuantHub
    fetch_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interval VARCHAR(10) DEFAULT '1D',
    is_latest BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    UNIQUE (instrument_id, qh_timestamp, interval)
);

-- Cache metadata table
CREATE TABLE IF NOT EXISTS cache_metadata (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(100) UNIQUE NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiration_minutes INTEGER DEFAULT 1440, -- 24 hours
    data_count INTEGER,
    status VARCHAR(20) -- 'fresh', 'stale', 'expired'
);

-- Market metrics table (Volatility, RVOL, etc.)
CREATE TABLE IF NOT EXISTS market_metrics (
    id SERIAL PRIMARY KEY,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id),
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(15, 6),
    period VARCHAR(20),
    calc_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);

-- User templates for planner configs
CREATE TABLE IF NOT EXISTS user_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    template_type VARCHAR(20) NOT NULL, -- 'ENTRY' or 'EXIT'
    payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Simulator sessions
CREATE TABLE IF NOT EXISTS sim_sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state_payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_instruments_product_id ON instruments(product_id);
CREATE INDEX idx_instruments_type ON instruments(instrument_type);
CREATE INDEX idx_ohlc_instrument_id ON ohlc_data(instrument_id);
CREATE INDEX idx_ohlc_latest ON ohlc_data(instrument_id, is_latest);
CREATE INDEX idx_ohlc_timestamp ON ohlc_data(fetch_timestamp);
CREATE INDEX idx_metrics_instrument_id ON market_metrics(instrument_id);