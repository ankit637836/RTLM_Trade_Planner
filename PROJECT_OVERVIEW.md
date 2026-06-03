# RTLM: Real-Time Ladder Manager
## Complete Project Documentation

**Version:** 1.0 (Under Development)  
**Project Type:** Trading Technology / Financial Engineering  
**Team Size:** 2-3 developers (scaling to support 500 traders)  
**Status:** Phase 2 - Backend Refactoring (In Progress)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Current State (Existing)](#current-state-existing)
5. [Future State (Being Built)](#future-state-being-built)
6. [Tech Stack](#tech-stack)
7. [Architecture](#architecture)
8. [Project Structure](#project-structure)
9. [Core Concepts & Algorithms](#core-concepts--algorithms)
10. [Development Roadmap](#development-roadmap)
11. [API Specification](#api-specification)
12. [Database Schema](#database-schema)
13. [Key Configuration & Constants](#key-configuration--constants)
14. [Security & Compliance](#security--compliance)
15. [Deployment Strategy](#deployment-strategy)
16. [Team Responsibilities](#team-responsibilities)

---

## Executive Summary

**RTLM (Real-Time Ladder Manager)** is a web-based trade planning and optimization tool for professional futures traders specializing in Short-Term Interest Rate (STIR) contracts.

**Core Function:** Given a trader's trade idea in plain English (e.g., "Buy SR3 at 99.50, risk $2000, 2:1 reward"), RTLM instantly:
1. Fetches live market data (current price, volatility, historical ranges)
2. Uses AI (Claude) to parse the trade idea
3. Generates optimized entry ladders across 4 different allocation models
4. Calculates exact lot sizes to match target risk
5. Simulates exit strategies and market-making overlays
6. Displays visual DOM-style price ladders and execution plans

**Current Users:** Rates desk traders at a hedge fund / proprietary trading firm  
**Current Scale:** 1-5 traders (proof of concept)  
**Target Scale:** 500 traders (enterprise deployment)

**Business Value:**
- **Reduce analysis time:** 2 minutes to generate optimized entry plan (vs. 20 minutes manual)
- **Improve consistency:** Same algorithm for all traders, removes emotional bias
- **Better risk management:** Exact lot allocation to hit target risk within tolerance
- **Simulation capability:** Test exit strategies before entering trade

---

## Problem Statement

### Before RTLM

Rates traders manually:
1. Decide entry price and stop loss
2. Calculate number of levels to enter ("ladder")
3. Manually allocate lots to each level, trying to match target risk
4. Calculate average entry price
5. Determine exit strategy manually
6. Plan risk/reward ratio

**Issues:**
- **Time-consuming:** 15-20 minutes per trade idea
- **Inconsistent:** Different traders use different rules
- **Error-prone:** Manual calculations lead to mistakes
- **Static:** Can't quickly compare different allocation strategies
- **No simulation:** Can't test exit plans before trading

### Why Current HTML File Isn't Enough

Previous developer built a single-file HTML/React proof-of-concept that works for 1-2 traders but:
- **Not scalable:** 1,800 lines in one file, hard to maintain
- **No persistence:** Can't save trade plans or execution history
- **No multi-user:** No user authentication or separate workspaces
- **Limited data:** Manual volatility selection, no automated analysis
- **No backend:** All logic in browser, no proper API
- **No database:** No historical tracking of trades or outcomes
- **Deployment issues:** Firewall blocks market data API calls from external hosting

---

## Solution Overview

### What RTLM Solves

RTLM transforms trade planning:

```
Trader Input          Process              Output
"Buy SR3 @ 99.50,  →  [AI Parse]      →   Entry Ladder:
 risk $2000"         [Fetch data]         - 99.50: 8 lots
                     [Calculate]          - 99.49: 7 lots
                     [4 Models]           - 99.48: 6 lots
                     [Visualize]          ... (11 total levels)
                                         
                                         Metrics:
                                         Total Risk: $1998 ✓
                                         Avg Entry: 99.469
                                         R:R: 1.62:1
                                         
                                         4 Models Shown:
                                         ✓ EQUAL
                                         ✓ FRONT-LOADED
                                         ✓ BACK-LOADED
                                         ✓ MANUAL
```

### Key Capabilities

**Entry Planning:**
- AI-powered prompt parsing (trader speaks English, not spreadsheets)
- 4 simultaneous allocation models (different risk/reward philosophies)
- Risk solver with 2 modes: EXACT_RISK and BEST_R:R
- Live market data injection (current price, ATR, volatility)
- DOM-style price visualization with entry levels

**Exit Planning:**
- Direct target mode: simple hold-to-TP strategy
- Range Trader mode: market-making overlay with buy/sell band cycles
- Animated price simulation (tick-by-tick random walk with drift)
- P&L estimation and breakeven churn calculation

**Market Data:**
- Live OHLC data for 6 STIR contracts × 4 quarterly expirations
- ATR (Average True Range) calculation for volatility
- Realized volatility and seasonality analysis
- Integration with internal Quant Hub API

---

## Current State (Existing)

### What's Already Built

**Single HTML File:** `RTLM.html` (~1,800 lines)

**Stack:**
- Frontend: React 18 (via CDN)
- Babel: Inline JSX transpilation in browser
- External APIs: Anthropic Claude, Quant Hub

**Features Implemented:**
✅ Entry Planner (fully functional)
- AI prompt parsing via Claude
- 4 entry allocation models (EQUAL, FRONT-LOADED, BACK-LOADED, MANUAL)
- Risk solver with EXACT_RISK and BEST_R:R modes
- DOM-style ladder visualization
- Order plan generation (copy-paste ready)

✅ Exit Planner (partially built)
- Direct Target mode
- Range Trader (RT) mode with sell/buyback bands
- RT animator with tick-by-tick price simulation
- P&L tracking and churn counting

✅ Market Data Tab (in progress)
- Live price grid for 5 products × 4 contracts
- OHLC data display
- Change % color-coded visualization

### Known Issues with Current Implementation

1. **Monolithic codebase:** 1,800 lines in single file
2. **No persistence:** Can't save trade plans
3. **No multi-user:** No authentication or user separation
4. **No execution tracking:** Can't see what actually filled vs. what was planned
5. **Network limitation:** Fails on external hosting (firewall blocks QH API)
6. **SELL direction bug:** Range Trader sign handling needs verification
7. **Manual volatility:** Trader selects volatility manually (LOW/MED/HIGH)
8. **Static FX rates:** EUR/USD, GBP/USD, CHF/USD hardcoded
9. **No analytics:** Can't track historical performance or statistics
10. **Poor testability:** All logic in browser, no unit tests

### Current Architecture (Proof of Concept)

```
Browser (Single HTML File)
├── React 18 Components
│   ├── EntryPlanner UI
│   ├── ExitPlanner UI
│   └── MarketData UI
├── JavaScript Business Logic
│   ├── Risk Solver (grid search + greedy)
│   ├── Ladder Generator
│   ├── RT Simulator & Animator
│   ├── ATR Calculator
│   └── Math Utilities
└── API Calls (Direct from Browser)
    ├── Anthropic Claude API (parse trade ideas)
    ├── Quant Hub API (fetch market data)
    └── [No local database, no backend]
```

**Problem:** Monolithic, not scalable to 500 users.

---

## Future State (Being Built)

### New Architecture (Enterprise-Ready)

We're refactoring from proof-of-concept to production system:

```
Tier 1: Frontend (Separate React App)
├── React 18 + TypeScript
├── Components (modular, testable)
├── Redux state management
├── API client (calls backend, not external APIs)
└── WebSocket (real-time updates)

Tier 2: Backend (Python FastAPI)
├── Trade Planning API
│   ├── /api/trades/parse (Claude integration)
│   ├── /api/trades/solve (risk solver)
│   └── /api/trades/execute (order execution)
├── Market Data API
│   ├── /api/market/prices (QH API proxy)
│   ├── /api/market/atrs (calculated metrics)
│   └── /api/market/contracts (contract specs)
├── Analytics API
│   ├── /api/analytics/performance
│   └── /api/analytics/statistics
└── Auth API
    └── /api/auth/login

Tier 3: Data Layer
├── PostgreSQL (trades, positions, users)
├── TimescaleDB (OHLC time-series data)
├── MongoDB (flexible schema for trade plans)
└── Redis (caching: contracts, ATR, prices)

Tier 4: Infrastructure
├── Kubernetes (orchestration, auto-scaling)
├── Docker (containerization)
├── Message Queue (RabbitMQ/Kafka for async jobs)
├── Monitoring (Prometheus + Grafana)
└── Logging (ELK stack)

Tier 5: External Services
├── Anthropic Claude API (AI parsing)
├── Quant Hub API (market data, via proxy)
└── Exchange APIs (order execution, future)
```

**Advantages:**
- Scalable to 500+ concurrent traders
- Persistent data (save/load trade plans)
- Multi-user with authentication
- Robust error handling and monitoring
- Testable code (unit tests, integration tests)
- Deployment to cloud (Kubernetes)

---

## Tech Stack

### Why These Choices?

#### **Frontend: React 18 + TypeScript**
| Choice | Why |
|--------|-----|
| **React 18** | Industry standard for web UIs, component reusability, hooks for state management |
| **TypeScript** | Catch errors at compile-time, better IDE support, easier refactoring |
| **Redux** | Central state management for complex UI state (ladders, solver results, market data) |
| **TailwindCSS** | Rapid UI development, consistency, dark mode support |
| **Recharts** | React-friendly charting library for DOM visualization, OHLC graphs |

#### **Backend: Python + FastAPI**
| Choice | Why |
|--------|-----|
| **Python 3.10+** | Math-heavy calculations, excellent libraries (NumPy, Pandas), AI integrations easy |
| **FastAPI** | Fast, async-ready, automatic API documentation (Swagger), type hints throughout |
| **Uvicorn** | ASGI server, handles WebSocket connections, production-ready |
| **Pydantic** | Data validation, serialization, schema generation |

#### **Database: PostgreSQL + TimescaleDB**
| Choice | Why |
|--------|-----|
| **PostgreSQL** | Reliable, ACID transactions, good for relational data (users, trades, positions) |
| **TimescaleDB** | Extension for time-series data (OHLC candles), better for 1M+ rows, automatic partitioning |
| **Redis** | In-memory cache for frequently accessed data (contract specs, ATR, current prices) |

#### **API Clients**
| Service | Integration | Why |
|---------|-----------|-----|
| **Anthropic Claude** | Direct HTTP (with API key) | Parse trade ideas to JSON, no library needed |
| **Quant Hub (QH)** | HTTP proxy via backend | Can't call directly from frontend (firewall), backend proxies calls |
| **Exchange APIs** | REST / FIX (future) | Order execution, fills tracking |

#### **DevOps: Docker + Kubernetes**
| Choice | Why |
|--------|-----|
| **Docker** | Containerize backend, database, cache - consistent across dev/staging/prod |
| **Kubernetes** | Auto-scale to 500 traders, load balancing, rolling updates, self-healing |
| **GitHub Actions** | CI/CD pipeline, run tests on every commit, auto-deploy to staging |

#### **Testing: Pytest**
| Choice | Why |
|--------|-----|
| **Pytest** | Industry standard for Python, excellent fixtures, parametrized tests, coverage reporting |
| **Pytest-Mock** | Mock external API calls in tests (Claude, QH) |
| **Pytest-Cov** | Code coverage analysis |

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TRADER CLIENTS (500x)                       │
│  (Browser) ← WebSocket for real-time updates                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ REST API + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     LOAD BALANCER (Nginx)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ Backend │         │ Backend │         │ Backend │  (3 replicas)
    │ Pod 1   │         │ Pod 2   │         │ Pod 3   │
    └────┬────┘         └────┬────┘         └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │PostgreSQL          │ Redis   │    │RabbitMQ │
    │ (Primary)          │(Cache)  │    │(Queue)  │
    └─────────┘         └─────────┘         └─────────┘
         │
         └──────► TimescaleDB (OHLC time-series)
         
         
    ┌─────────────────────────────────────────┐
    │   External APIs (via Backend)            │
    ├─────────────────────────────────────────┤
    │ • Anthropic Claude (trade idea parsing)  │
    │ • Quant Hub (market data via proxy)      │
    │ • Exchange APIs (order execution)        │
    └─────────────────────────────────────────┘
```

### Data Flow: From Trader Prompt to Order Plan

```
1. TRADER PROMPT
   ├─ Input: "Buy SR3 at 99.50, risk $2000, 2:1"
   └─ Sent via: Frontend → POST /api/trades/parse

2. MARKET DATA FETCH
   ├─ Backend queries Redis cache
   ├─ If miss: calls QH API (via proxy)
   │  └─ Returns: current price, ATR, volatility
   └─ Data: {price: 99.495, ATR: 0.085, vol: 14.2%}

3. AI PARSING (Claude)
   ├─ Send: system prompt (with market context) + trader prompt
   ├─ Claude returns JSON:
   │  {
   │    "direction": "BUY",
   │    "product": "SR3",
   │    "startPrice": 99.50,
   │    "stopPrice": 99.415,     (inferred from ATR)
   │    "tpPrice": 99.67,        (inferred from ATR)
   │    "interval": 0.01,
   │    "targetRisk": 2000,
   │    "volatility": "MEDIUM"
   │  }
   └─ Data validated by Pydantic schema

4. LADDER GENERATION
   ├─ Call: LadderGenerator.generate()
   ├─ Returns: [99.50, 99.49, 99.48, ..., 99.415]
   └─ 11 levels from start to stop with 0.01 interval

5. RISK CALCULATION
   ├─ For each level: calculate risk per lot
   │  risk_per_lot = (level - stop) / tickSize × usdTickValue
   │  Example: (99.50 - 99.415) / 0.005 × $12.50 = $250
   └─ Returns: [250, 237.5, 225, ..., 0]

6. SOLVER (4 Models in Parallel)
   ├─ Model 1 (EQUAL):
   │  └─ Lots: [7, 7, 7, 7, 7, 7, 7, 7, 5]  (simple)
   ├─ Model 2 (FRONT-LOADED):
   │  └─ Lots: [10, 8, 7, 6, 5, 4, 3, 2, 1] (aggressive)
   ├─ Model 3 (BACK-LOADED):
   │  └─ Lots: [2, 3, 4, 5, 6, 7, 8, 9, 10] (patient)
   └─ Model 4 (MANUAL):
       └─ User edits directly with live feedback

7. METRICS CALCULATION
   ├─ avgEntry = SUM(price[i] × lots[i]) / SUM(lots[i])
   ├─ totalRisk = SUM(lots[i] × risk_per_lot[i])
   ├─ totalReward = SUM(lots[i] × (tp - price[i]) × usdTickValue)
   └─ R:R = totalReward / totalRisk

8. RESPONSE TO TRADER
   ├─ Return JSON:
   │  {
   │    "models": [
   │      {
   │        "modelType": "EQUAL",
   │        "ladder": [...],
   │        "lots": [...],
   │        "avgEntry": 99.469,
   │        "totalRisk": 1998,
   │        "totalReward": 3240,
   │        "rr": 1.62,
   │        "orderPlan": "BUY 7 @ 99.50\nBUY 7 @ 99.49\n..."
   │      },
   │      ...  (3 more models)
   │    ]
   │  }
   └─ Frontend displays all 4 side-by-side
```

---

## Project Structure

### Current (Phase 1: Understanding)
```
rtlm-project/
├── docs/
│   ├── PROJECT_OVERVIEW.md         (this file)
│   ├── RTLM_TECHNICAL_DEEP_DIVE.md
│   ├── RTLM_SKILL.md
│   ├── RTLM_INSTRUCTIONS.md
│   └── RTLM_WINDOWS_SETUP.md
├── src/
│   ├── __init__.py
│   ├── models/
│   │   └── __init__.py             (RiskSolverInput, LadderLevel, etc.)
│   ├── services/
│   │   └── LadderGenerator.py      (Pure math logic)
│   ├── apis/
│   │   └── (placeholder for external API clients)
│   ├── schemas/
│   │   └── (placeholder for request/response schemas)
│   ├── utils/
│   │   └── (placeholder for helpers)
│   └── config/
│       └── constants.py             (Contract specs, FX rates)
├── tests/
│   ├── __init__.py
│   ├── unit/
│   │   └── test_ladder_generator.py
│   └── integration/
│       └── (placeholder)
├── data/
│   └── fixtures/                    (Test data, CSV of contracts)
├── notebooks/
│   └── (placeholder for Jupyter exploration)
├── venv/                            (Virtual environment)
├── .gitignore
├── .env                             (Secrets, not committed)
├── requirements.txt
├── README.md                        (Getting started)
└── git/
    └── (commits)
```

### After Phase 2 (Backend Core)
```
rtlm-project/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   ├── trade.py
│   │   │   ├── position.py
│   │   │   ├── user.py
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── RiskSolver.py       (Core algorithm)
│   │   │   ├── LadderGenerator.py
│   │   │   ├── RTSimulator.py
│   │   │   ├── MarketDataService.py
│   │   │   ├── ClaudeService.py
│   │   │   └── AnalyticsService.py
│   │   ├── apis/
│   │   │   ├── anthropic_client.py
│   │   │   ├── qh_proxy.py
│   │   │   └── exchange_client.py
│   │   ├── routes/
│   │   │   ├── trade_routes.py
│   │   │   ├── market_routes.py
│   │   │   ├── analytics_routes.py
│   │   │   └── auth_routes.py
│   │   ├── middleware/
│   │   │   ├── auth.py
│   │   │   ├── rate_limit.py
│   │   │   └── error_handler.py
│   │   ├── schemas/
│   │   │   ├── trade_schema.py
│   │   │   └── market_schema.py
│   │   ├── database/
│   │   │   ├── models.py           (SQLAlchemy models)
│   │   │   ├── migrations/
│   │   │   └── session.py
│   │   ├── config/
│   │   │   ├── constants.py
│   │   │   ├── settings.py
│   │   │   └── logging.py
│   │   └── main.py
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── EntryPlanner/
│   │   │   ├── ExitPlanner/
│   │   │   └── MarketData/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
├── kubernetes/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── docs/
    ├── PROJECT_OVERVIEW.md          (this file, updated)
    ├── API_SPECIFICATION.md
    ├── DATABASE_SCHEMA.md
    ├── DEPLOYMENT_GUIDE.md
    └── TROUBLESHOOTING.md
```

---

## Core Concepts & Algorithms

### 1. Contract Specifications (Fixed Constants)

All 6 supported STIR contracts:

```python
CONTRACTS = {
    "SR3": {
        "name": "3M SOFR",
        "exchange": "CME",
        "tickSize": 0.005,        # Minimum price move
        "usdTickValue": 12.50,    # $ per tick
        "currency": "USD"
    },
    "SR1": {
        "name": "1M SOFR",
        "exchange": "CME",
        "tickSize": 0.005,
        "usdTickValue": 12.50,
        "currency": "USD"
        # NOTE: Delisted as of May 2026
    },
    "ZQ": {
        "name": "Fed Funds",
        "exchange": "CBOT",
        "tickSize": 0.005,
        "usdTickValue": 20.835,   # Largest tick value
        "currency": "USD"
    },
    "I": {
        "name": "Euribor",
        "exchange": "ICE",
        "tickSize": 0.005,
        "usdTickValue": 12.50,    # In EUR, convert to USD
        "currency": "EUR",
        "fxRate": 1.154           # EUR/USD
    },
    "SO3": {
        "name": "3M SONIA",
        "exchange": "ICE",
        "tickSize": 0.005,
        "usdTickValue": 12.50,
        "currency": "GBP",
        "fxRate": 1.323           # GBP/USD
    },
    "SA3": {
        "name": "3M SARON",
        "exchange": "ICE",
        "tickSize": 0.005,
        "usdTickValue": 12.50,
        "currency": "CHF",
        "fxRate": 1.252           # CHF/USD
    }
}
```

**Key insight:** Tick size is always 0.005, but USD tick value varies by contract. ZQ has 1.67x larger impact than SR3.

### 2. Ladder Generation

Convert start/stop price range into entry levels:

```python
def generate_ladder(start, stop, interval, direction="BUY"):
    """
    For BUY: generate downward from start to stop
    For SELL: generate upward from start to stop
    """
    if direction == "BUY":
        # start > stop (entering lower)
        # Example: 99.50 to 99.40 with 0.01 interval
        # Result: [99.50, 99.49, 99.48, ..., 99.40]
        return [start - i*interval for i in range(...)]
    else:
        # start < stop (entering higher)
        # Example: 100.10 to 100.20 with 0.01 interval
        # Result: [100.10, 100.11, 100.12, ..., 100.20]
        return [start + i*interval for i in range(...)]
```

### 3. Risk Calculation (Per Level)

For each price level in the ladder, calculate risk per lot:

```python
def calculate_risk_per_lot(level, stop_price, contract, direction):
    """
    For BUY:
        risk_distance = level - stop_price
        risk_per_lot = risk_distance / tickSize × usdTickValue
        
    For SELL:
        risk_distance = stop_price - level
        risk_per_lot = risk_distance / tickSize × usdTickValue
    
    Example (BUY SR3):
        level = 99.50, stop = 99.40
        risk_distance = 0.10
        risk_ticks = 0.10 / 0.005 = 20
        risk_per_lot = 20 × $12.50 = $250
    """
```

### 4. Risk Solver: EXACT_RISK Mode

Goal: Find integer lots for each level such that total risk ≈ target risk ± tolerance

**Algorithm: Grid Search**

```python
def solve_exact_risk(ladder, risk_per_level, target_risk, tolerance):
    """
    1. Calculate denominator = sum of risk_per_level
    2. Calculate k_initial = target_risk / denominator
    3. Grid search around k_initial:
       For each k in [k_initial - 0.5, k_initial + 0.5]:
           lots[i] = round(k × risk_per_level[i])
           total_risk = sum(lots[i] × risk_per_level[i])
           if abs(total_risk - target_risk) <= tolerance:
               return lots[]
    4. If no solution found, fallback to 1 lot at cheapest risk level
    """
```

**Time complexity:** O(n × steps) where n = ladder levels, steps = grid granularity  
**Typical:** 11 levels × 100 steps = 1,100 evaluations = <10ms

### 5. Risk Solver: BEST_R:R Mode

Goal: Maximize reward/risk ratio while staying within risk tolerance

**Algorithm: Greedy Allocation**

```python
def solve_best_rr(ladder, risk_per_level, tp_price, target_risk):
    """
    1. Start with lots = [0, 0, 0, ...]
    2. Loop until total_risk >= target_risk:
       For each level not at max:
           Calculate: new_total_rr if we add 1 lot here
           Find level with best new_total_rr
           Add 1 lot to that level
    3. Refinement: swap lots between levels if improves R:R
    """
```

**Result:** More lots at high-reward levels, fewer at high-risk levels

### 6. Average Entry Calculation

Weighted average of entry prices by lots allocated:

```python
avg_entry = sum(price[i] × lots[i]) / sum(lots[i])

Example:
  Price:  [99.50, 99.49, 99.48]
  Lots:   [8,     7,     6    ]
  
  avg_entry = (99.50×8 + 99.49×7 + 99.48×6) / (8+7+6)
            = 99.469
```

### 7. Total Risk & Reward

```python
total_risk = sum(lots[i] × risk_per_level[i])
           = sum of all stop-loss distances in USD

total_reward = sum(lots[i] × (tp_price - price[i]) × (1/tickSize) × usdTickValue)
             = sum of all profit-taking distances in USD

rr_ratio = total_reward / total_risk
```

### 8. Range Trader (RT) Simulator

Market-making overlay on top of core position:

```python
Core position: 52 lots (hold until TP, never reduce)

RT Bands: Sell rallies, buyback dips
  Band 1: SELL @ 99.47, BUYBACK @ 99.42
  Band 2: SELL @ 99.52, BUYBACK @ 99.47
  Band 3: SELL @ 99.57, BUYBACK @ 99.52
  ...
  
Each churn: SELL 4 @ 99.47, BUYBACK 4 @ 99.42
  Profit = 4 × (99.47 - 99.42) × (0.05/0.005) × $12.50 = $500

RT runs independent of core: price rallies/dips, RT churns profit
When TP hit: exit core 52 lots at TP + accumulated RT P&L
```

---

## Development Roadmap

### Phase 1: Understanding (✅ Current - Weeks 1-2)
- [x] Read existing HTML code
- [x] Understand monolithic architecture
- [x] Document technical debt
- [x] Identify refactoring points

**Deliverable:** This documentation + understanding

### Phase 2: Backend Core (⏳ In Progress - Weeks 3-6)
- [ ] Extract risk solver to Python service
- [ ] Extract ladder generator to Python service
- [ ] Extract RT simulator logic
- [ ] Unit tests for all services
- [ ] No database, no API yet (pure logic extraction)

**Code modules:**
```
src/
├── services/
│   ├── LadderGenerator.py
│   ├── RiskSolver.py
│   ├── RTSimulator.py
│   └── MarketDataService.py
├── models/
│   └── __init__.py (data classes)
└── config/
    └── constants.py
```

**Output:** Testable Python modules, >80% code coverage

### Phase 3: FastAPI Backend (Weeks 7-11)
- [ ] Create FastAPI app with routes
- [ ] Connect risk solver to HTTP endpoint
- [ ] PostgreSQL database setup
- [ ] User authentication (JWT)
- [ ] Trade persistence (save/load)
- [ ] QH API proxy (backend calls QH, not frontend)
- [ ] Claude integration service

**Endpoints:**
```
POST /api/trades/parse          (Claude AI parsing)
POST /api/trades/solve          (Risk solver)
GET  /api/market/prices         (Market data proxy)
POST /api/execution/submit       (Save trade plan)
GET  /api/trader/history        (Load past trades)
```

**Output:** REST API, all data persisted, multi-user support

### Phase 4: Frontend Refactor (Weeks 12-16)
- [ ] Split monolithic HTML into React components
- [ ] TypeScript for type safety
- [ ] Redux state management
- [ ] API client (calls backend, not external APIs)
- [ ] WebSocket for real-time updates
- [ ] Same UI/UX as before, but modular

**Output:** Modern React codebase, 500-trader ready

### Phase 5: DevOps & Deployment (Weeks 17-20)
- [ ] Docker containerization (backend + frontend)
- [ ] Kubernetes manifests
- [ ] Database migrations
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring & logging (Prometheus, ELK)
- [ ] Staging environment

**Output:** Production-ready deployment, auto-scaling

### Phase 6: New Features (Weeks 21+)
- [ ] Partial fill re-planner
- [ ] Multi-leg strategies (spreads, butterflies)
- [ ] Historical analytics dashboard
- [ ] Risk exposure tracker
- [ ] Trade outcome analysis
- [ ] Backtesting engine

**Output:** Enterprise features, trader-requested enhancements

---

## API Specification

### Phase 3 API (FastAPI Endpoints)

#### 1. Parse Trade Idea
```
POST /api/trades/parse
Content-Type: application/json

Request:
{
  "prompt": "Buy SR3 at 99.50, risk $2000, 2:1",
  "marketContext": {
    "product": "SR3",
    "currentPrice": 99.495,
    "atr10": 0.085,
    "volatility": 14.2
  }
}

Response:
{
  "direction": "BUY",
  "product": "SR3",
  "startPrice": 99.50,
  "stopPrice": 99.415,
  "tpPrice": 99.67,
  "interval": 0.01,
  "targetRisk": 2000.0,
  "volatility": "MEDIUM",
  "solverMode": "EXACT_RISK"
}
```

#### 2. Solve Ladder
```
POST /api/trades/solve
Content-Type: application/json

Request:
{
  "direction": "BUY",
  "product": "SR3",
  "startPrice": 99.50,
  "stopPrice": 99.415,
  "tpPrice": 99.67,
  "interval": 0.01,
  "targetRisk": 2000.0,
  "tolerance": 0.05,
  "solverMode": "EXACT_RISK"
}

Response:
{
  "models": [
    {
      "modelType": "EQUAL",
      "ladder": [99.50, 99.49, 99.48, ...],
      "lots": [7, 7, 7, ...],
      "avgEntry": 99.469,
      "totalLots": 41,
      "totalRisk": 1998.0,
      "totalReward": 3240.0,
      "riskRewardRatio": 1.62,
      "orderPlan": [
        {"price": 99.50, "lots": 7, "risk": 175},
        ...
      ]
    },
    {
      "modelType": "FRONT-LOADED",
      ...
    },
    ...
  ]
}
```

#### 3. Get Market Data
```
GET /api/market/prices?contracts=SR3,ZQ,I

Response:
{
  "SR3": {
    "price": 99.495,
    "atr10": 0.085,
    "atr20": 0.082,
    "volatility": 14.2,
    "volume": 15000
  },
  "ZQ": {...},
  "I": {...}
}
```

#### 4. Submit Trade
```
POST /api/execution/submit
Content-Type: application/json

Request:
{
  "traderId": "trader_001",
  "solvedLadder": {
    "modelType": "EQUAL",
    "ladder": [...],
    "lots": [...]
  },
  "comment": "Bullish on Fed cuts"
}

Response:
{
  "tradeId": "trade_12345",
  "status": "SUBMITTED",
  "createdAt": "2026-06-03T14:30:00Z"
}
```

---

## Database Schema

### Phase 3 Database (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  passwordHash VARCHAR NOT NULL,
  role VARCHAR (TRADER, ADMIN, ANALYST),
  maxRiskPerTrade DECIMAL,
  maxDailyExposure DECIMAL,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- Trade plans (saved entries)
CREATE TABLE trade_plans (
  id SERIAL PRIMARY KEY,
  userId INT REFERENCES users(id),
  product VARCHAR,
  direction VARCHAR (BUY, SELL),
  startPrice DECIMAL,
  stopPrice DECIMAL,
  tpPrice DECIMAL,
  interval DECIMAL,
  targetRisk DECIMAL,
  solverMode VARCHAR,
  modelType VARCHAR,
  lots INTEGER[],
  avgEntry DECIMAL,
  totalRisk DECIMAL,
  totalReward DECIMAL,
  riskRewardRatio DECIMAL,
  status VARCHAR (DRAFT, SUBMITTED, EXECUTED, CANCELED),
  notes TEXT,
  createdAt TIMESTAMP,
  executedAt TIMESTAMP
);

-- Executed trades
CREATE TABLE executions (
  id SERIAL PRIMARY KEY,
  planId INT REFERENCES trade_plans(id),
  userId INT REFERENCES users(id),
  product VARCHAR,
  filledLots INTEGER,
  avgFillPrice DECIMAL,
  executionTime TIMESTAMP,
  status VARCHAR (PENDING, FILLED, PARTIAL, CANCELED)
);

-- P&L tracking (TimescaleDB hypertable)
CREATE TABLE pnl_history (
  time TIMESTAMPTZ NOT NULL,
  executionId INT REFERENCES executions(id),
  entryPrice DECIMAL,
  currentPrice DECIMAL,
  unrealizedPnL DECIMAL,
  realizedPnL DECIMAL,
  rtChurns INTEGER,
  rtPnL DECIMAL
);

SELECT create_hypertable('pnl_history', 'time');

-- OHLC market data (TimescaleDB)
CREATE TABLE market_data (
  time TIMESTAMPTZ NOT NULL,
  product VARCHAR NOT NULL,
  contractCode VARCHAR NOT NULL,
  open DECIMAL,
  high DECIMAL,
  low DECIMAL,
  close DECIMAL,
  volume INTEGER
);

SELECT create_hypertable('market_data', 'time');
CREATE INDEX ON market_data (product, time DESC);
```

---

## Key Configuration & Constants

### Contract Specs (Immutable)
See `src/config/constants.py` - all 6 STIR contracts with tick sizes, USD values, currencies

### FX Rates (Dynamic Eventually)
Currently hardcoded:
```python
FX_RATES = {
    "EUR": 1.154,
    "GBP": 1.323,
    "CHF": 1.252
}
```

**Future (Phase 3):** Fetch daily from QH API

### Solver Parameters
```python
SOLVER_MODES = ["EXACT_RISK", "BEST_RR"]
VOLATILITY_LEVELS = ["LOW", "MED", "HIGH"]
VOLATILITY_FACTORS = {
    "LOW": 0.5,      # Tight ladder
    "MED": 1.0,      # Normal ladder
    "HIGH": 1.5      # Wide ladder
}
```

### API Limits
```python
CLAUDE_MODEL = "claude-sonnet-4-20250514"
QH_API_RATE_LIMIT = 50  # requests per minute
QH_API_DAILY_LIMIT = 50000  # total daily requests
```

---

## Security & Compliance

### Authentication
- JWT tokens issued on login, 24-hour expiration
- Refresh tokens for extended sessions
- Role-based access control (TRADER, ADMIN, ANALYST)

### Data Protection
- All API calls over HTTPS
- Database encryption at rest
- API keys stored in environment variables (not in code)
- Audit logging of all trades and executions

### Risk Management
- Per-trader risk limits (maxRiskPerTrade, maxDailyExposure)
- Validation of all input ranges (price, lots, risk)
- Position limits enforcement at submission
- Real-time exposure dashboard (future)

### Compliance
- Trade audit trail (all submissions + fills logged)
- Regulatory reporting ready (future: CFTC, SEC)
- Backup & disaster recovery (daily snapshots to S3)

---

## Deployment Strategy

### Development
```
Single Docker container with all services
- Backend (Python)
- PostgreSQL (local)
- Redis (local)
- Frontend (React dev server)
```

### Staging
```
Kubernetes cluster (3 nodes)
- Backend replicas (3x)
- PostgreSQL (managed)
- Redis cluster (3 nodes)
- Frontend on CDN
```

### Production
```
Kubernetes cluster (6+ nodes)
- Backend replicas (6x load-balanced)
- PostgreSQL (managed RDS)
- TimescaleDB for time-series
- Redis cluster (3 nodes)
- Frontend on CloudFront CDN
- RabbitMQ (3 nodes mirrored)
- Prometheus + Grafana monitoring
- ELK stack for logging
```

---

## Team Responsibilities

### Developer Roles

| Role | Responsibility | Phase |
|------|-----------------|-------|
| **Backend Engineer** | Risk solver, ladder generation, services | 2-3 |
| **Frontend Engineer** | React components, UI/UX, WebSocket | 4 |
| **DevOps Engineer** | Docker, Kubernetes, CI/CD, monitoring | 5 |
| **QA Engineer** | Test automation, load testing, scenarios | All |
| **Product Manager** | Requirements, roadmap, trader feedback | All |

### Current Team
- **You (Developer 1):** Backend core extraction (Phase 2)
- **Future hires:** Frontend engineer (Phase 4), DevOps (Phase 5)

### Communication
- **Daily:** Slack updates on progress
- **Weekly:** 30-min sync on blockers
- **Bi-weekly:** Demo to stakeholders
- **Quarterly:** Roadmap planning

---

## Key Documents

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **PROJECT_OVERVIEW.md** (this) | High-level project context | Onboarding |
| **RTLM_TECHNICAL_DEEP_DIVE.md** | Risk solver math, RT simulator, API flows | Phase 2 development |
| **RTLM_SKILL.md** | Claude AI skill (contract specs, algorithms) | Configure VS Code |
| **RTLM_INSTRUCTIONS.md** | Python coding standards, patterns | Every coding session |
| **RTLM_WINDOWS_SETUP.md** | Step-by-step environment setup | First time setup |
| **VS_CODE_AGENT_SETUP.md** | How to configure AI agent in IDE | Configure extensions |

---

## Quick Reference

### What RTLM Does (1 Minute)
- Takes trader's English trade idea
- Parses it via Claude AI
- Generates optimal entry ladders (4 models)
- Calculates exact lot sizes to hit target risk
- Simulates exit strategies
- Displays visual DOM and order plans

### Tech Stack (30 Seconds)
- **Frontend:** React 18 + TypeScript
- **Backend:** Python + FastAPI
- **Database:** PostgreSQL + TimescaleDB
- **Cache:** Redis
- **Queue:** RabbitMQ
- **Infra:** Docker + Kubernetes

### Scale Target
- **Users:** 500 traders
- **Concurrent:** 50+ active simultaneously
- **Trades per day:** 1,000+
- **Data retention:** 5 years (for analytics)

### Success Metrics
- Parse trade idea to ladder in <2 seconds
- 99.9% uptime
- <100ms API response time (p99)
- Zero data loss (all trades persisted)
- Traders adopt all 4 models, not just one

---

## Appendix: Glossary

| Term | Definition |
|------|-----------|
| **Ladder** | Set of price levels where trader enters |
| **Lots** | Number of contracts at each price level |
| **STIR** | Short-Term Interest Rate futures |
| **Tick Size** | Minimum price move (0.005 for all 6 contracts) |
| **Tick Value** | USD per tick move (varies by contract) |
| **ATR** | Average True Range, volatility measure |
| **Risk Solver** | Algorithm to allocate lots matching target risk |
| **R:R** | Risk:Reward ratio (higher is better) |
| **Range Trader** | Market-making overlay (sell rallies, buyback dips) |
| **Churn** | One complete RT sell + buyback cycle |
| **QH API** | Quant Hub internal market data API |

---

**Document Version:** 1.0  
**Last Updated:** June 3, 2026  
**Next Review:** August 3, 2026 (End of Phase 2)

For questions or clarifications, reach out to the development team.
