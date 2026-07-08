# src/services/APIService.py

import logging
import os
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import json
from .LadderGenerator import LadderGenerator
from .RiskSolver import RiskSolver
from .ExitPlanner import ExitPlanner
from .MarketDataService import MarketDataService
from .RegimeAnalyzer import RegimeAnalyzer
from src.models.database import SessionLocal, UserTemplate, SimSession, init_db
from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

logger = logging.getLogger(__name__)

# Load products config
PRODUCTS = {}
try:
    with open("config/products.json", "r") as f:
        PRODUCTS = json.load(f)
except Exception as e:
    logger.error(f"Failed to load products.json: {e}")

app = FastAPI(title="RTLM API", version="3.0")

# Parse ALLOWED_ORIGINS, fallback to * for local development
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

market_service = MarketDataService()

@app.on_event("startup")
async def startup_event():
    try:
        init_db()
    except Exception as e:
        logger.error(f"Failed to initialize database (may be running without DB on Vercel): {e}")
    try:
        market_service.initialize_cache()
    except Exception as e:
        logger.error(f"Failed to initialize market cache: {e}")

@app.get("/")
def read_root():
    return {"status": "success", "message": "RTLM API backend is running normally."}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "RTLM Futures Planner API"}

# --- SCHEMAS ---

class EntrySolveRequest(BaseModel):
    direction: str
    product: str
    start_price: float
    end_price: float
    stop_price: float
    tp_price: float
    interval: float
    volatility: str
    target_risk: float
    tolerance_pct: float
    solver_mode: str = "EXACT_RISK"
    equal_lots: Optional[List[int]] = None
    front_lots: Optional[List[int]] = None
    back_lots: Optional[List[int]] = None
    raem_lots: Optional[List[int]] = None
    raem_start: Optional[float] = None
    raem_end: Optional[float] = None
    raem_stop: Optional[float] = None
    raem_tp: Optional[float] = None
    raem_base_shape: Optional[str] = None

class EntryModelData(BaseModel):
    model_id: str
    title: str
    subtitle: str
    lots: List[int]
    ladder: List[float]
    total_lots: int
    total_risk: float
    total_reward: float
    avg_entry: float

class ExitSolveRequest(BaseModel):
    direction: str
    product: str
    stop_price: float
    tp_price: float
    exit_mode: str = "direct"
    rt_spacing_ticks: int = 10
    rt_lots_per_band: int = 1
    crossing_override: Optional[int] = None
    rt_start_price: Optional[float] = None
    entry_models: List[Dict]

class TemplateCreate(BaseModel):
    name: str
    template_type: str
    payload: Dict

class SessionCreate(BaseModel):
    name: str
    state_payload: Dict

# --- ENDPOINTS ---

@app.get("/api/market/volatility/{contract_code}")
def get_volatility(contract_code: str):
    data = market_service.fetch_contract_volatility(contract_code)
    if not data:
        raise HTTPException(status_code=404, detail="Volatility data not found or insufficient bars")
    return {"status": "success", "data": data}

@app.post("/api/templates")
def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    db_template = db.query(UserTemplate).filter(UserTemplate.name == template.name, UserTemplate.template_type == template.template_type).first()
    if db_template:
        db_template.payload = template.payload
    else:
        db_template = UserTemplate(name=template.name, template_type=template.template_type, payload=template.payload)
        db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return {"status": "success", "id": db_template.id}

@app.get("/api/templates")
def get_templates(template_type: str = None, db: Session = Depends(get_db)):
    query = db.query(UserTemplate)
    if template_type:
        query = query.filter(UserTemplate.template_type == template_type)
    templates = query.all()
    return {"status": "success", "data": [{"id": t.id, "name": t.name, "template_type": t.template_type, "payload": t.payload} for t in templates]}

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    db_template = db.query(UserTemplate).filter(UserTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(db_template)
    db.commit()
    return {"status": "success"}

@app.post("/api/sessions")
def save_session(session: SessionCreate, db: Session = Depends(get_db)):
    db_session = db.query(SimSession).filter(SimSession.name == session.name).first()
    if db_session:
        db_session.state_payload = session.state_payload
    else:
        db_session = SimSession(name=session.name, state_payload=session.state_payload)
        db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return {"status": "success", "id": db_session.id}

@app.get("/api/sessions")
def get_sessions(db: Session = Depends(get_db)):
    sessions = db.query(SimSession).order_by(SimSession.created_at.desc()).all()
    return {"status": "success", "data": [{"id": s.id, "name": s.name, "state_payload": s.state_payload, "created_at": s.created_at} for s in sessions]}

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    db_session = db.query(SimSession).filter(SimSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(db_session)
    db.commit()
    return {"status": "success"}

@app.post("/api/entry/solve")
def solve_entry(req: EntrySolveRequest):
    if req.product not in PRODUCTS:
        raise HTTPException(status_code=400, detail=f"Unsupported product: {req.product}")
        
    contract_spec = PRODUCTS[req.product]
    
    try:
        # 1. Generate ladder
        ladder = LadderGenerator.generate(
            start_price=req.start_price,
            stop_price=req.end_price,
            interval=req.interval,
            direction=req.direction
        )
        
        # 2. Create solver
        solver = RiskSolver(
            direction=req.direction,
            tick_size=contract_spec['tickSize'],
            usd_tick_value=contract_spec['usdTickValue'],
            ladder=ladder,
            stop_price=req.stop_price,
            tp_price=req.tp_price,
            target_risk=req.target_risk
        )
        
        # 3. Compute models
        models = {}
        
        models["equal"] = solver.compute_model(
            model_id="equal", title="EQUAL", subtitle="Flat across ladder", 
            solver_mode=req.solver_mode, manual_lots=req.equal_lots
        )
        models["front_loaded"] = solver.compute_model(
            model_id="front_loaded", title="FRONT-LOADED", subtitle="Heavier near first entry", 
            solver_mode=req.solver_mode, manual_lots=req.front_lots
        )
        models["back_loaded"] = solver.compute_model(
            model_id="back_loaded", title="BACK-LOADED", subtitle="Heavier deeper in ladder", 
            solver_mode=req.solver_mode, manual_lots=req.back_lots
        )
        
        # 4. Compute Dynamic Allocator (RAEM) if bounds are provided
        if req.raem_start is not None and req.raem_end is not None:
            raem_ladder = LadderGenerator.generate(
                start_price=req.raem_start,
                stop_price=req.raem_end,
                interval=req.interval,
                direction=req.direction
            )
            raem_solver = RiskSolver(
                direction=req.direction,
                tick_size=contract_spec['tickSize'],
                usd_tick_value=contract_spec['usdTickValue'],
                ladder=raem_ladder,
                stop_price=req.raem_stop if req.raem_stop is not None else req.stop_price,
                tp_price=req.raem_tp if req.raem_tp is not None else req.tp_price,
                target_risk=req.target_risk
            )
            # Use dynamic shape from frontend
            models["raem"] = raem_solver.compute_model(
                model_id="raem", title="DYNAMIC ALLOCATOR", subtitle="RAEM Auto-Suggested Structure", 
                solver_mode=req.solver_mode, manual_lots=req.raem_lots, base_shape=req.raem_base_shape or "front_loaded"
            )
        else:
            models["raem"] = solver.compute_model(
                model_id="raem", title="DYNAMIC ALLOCATOR", subtitle="Pending Auto-Suggest (Using Base Bounds)", 
                solver_mode=req.solver_mode, manual_lots=req.raem_lots, base_shape=req.raem_base_shape or "front_loaded"
            )
            
        return {"status": "success", "models": models}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Solve error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error solving entry.")

@app.post("/api/exit/solve")
def solve_exit(req: ExitSolveRequest):
    if req.product not in PRODUCTS:
        raise HTTPException(status_code=400, detail=f"Unsupported product: {req.product}")
        
    contract_spec = PRODUCTS[req.product]
    planner = ExitPlanner(
        direction=req.direction,
        tick_size=contract_spec['tickSize'],
        usd_tick_value=contract_spec['usdTickValue']
    )
    
    # We pass the models to calculate_exit_for_all_models
    results = planner.calculate_exit_for_all_models(
        models=req.entry_models,
        stop_price=req.stop_price,
        tp_price=req.tp_price,
        exit_mode=req.exit_mode,
        rt_spacing_ticks=req.rt_spacing_ticks,
        rt_lots_per_band=req.rt_lots_per_band,
        crossing_override=req.crossing_override,
        rt_start_price=req.rt_start_price
    )
    
    return {"status": "success", "results": results}

@app.get("/api/config/products")
def get_products():
    return {"status": "success", "products": PRODUCTS}

@app.get("/api/market/contracts")
def get_contracts():
    return {"status": "success", "contracts": market_service.get_all_contracts()}

@app.get("/api/market/ohlc/{contract_code}")
def get_ohlc(contract_code: str):
    data = market_service.get_contract_ohlc(contract_code)
    if not data:
        raise HTTPException(status_code=404, detail="OHLC not found")
    return {"status": "success", "data": data}

@app.get("/api/auto-suggest/{contract_code}")
def auto_suggest(contract_code: str, interval: str = "1D", lookback: int = 30):
    try:
        # Fetch lookback + 1 days to provide a previous close for the first day's True Range calculation
        series = market_service.fetch_historical_series(contract_code, interval=interval, limit=lookback + 1)
        if not series:
            raise HTTPException(status_code=404, detail="Could not fetch historical series")
        
        # Calculate tick size (default 0.005 for STIRs, might need mapping from products.json)
        # Using 0.005 as a general default if we don't have it mapped explicitly
        tick_size = 0.005 
        
        suggestion = RegimeAnalyzer.generate_suggestion(series, tick_size=tick_size)
        if suggestion.get("status") == "error":
            raise HTTPException(status_code=400, detail=suggestion.get("message"))
            
        return suggestion
    except Exception as e:
        logger.error(f"Auto-suggest failed for {contract_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
# Trigger reload
