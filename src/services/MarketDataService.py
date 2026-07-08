"""
src/services/MarketDataService.py - Version 3
Fetch contracts list from /api/ohlc/products/ on startup
Provide contract metadata and single-contract OHLC fetching
"""

import os
import requests
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import desc
from src.models.database import OHLCData, Instrument, MarketMetric, Product, SessionLocal

from src.config.settings import LOG_LEVEL
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class MarketDataService:
    """Manages market data fetching and contract metadata"""

    # Target products to monitor
    TARGET_PRODUCTS = {}
    PREFIX_TO_PRODUCT = {}
    
    # Load dynamically from products.json
    try:
        with open("config/products.json", "r") as f:
            prods = json.load(f)
            for key, val in prods.items():
                TARGET_PRODUCTS[key] = val.get("qhPrefix")
            PREFIX_TO_PRODUCT = {v: k for k, v in TARGET_PRODUCTS.items()}
    except Exception as e:
        logger.error(f"Failed to load products.json in MarketDataService: {e}")

    # QuantHub API endpoints
    QH_BASE_URL = "https://qh-api.corp.hertshtengroup.com"
    QH_PRODUCTS_ENDPOINT = f"{QH_BASE_URL}/api/ohlc/products/"
    QH_OHLC_ENDPOINT = f"{QH_BASE_URL}/api/v2/ohlc/"

    def __init__(self, qh_token=None, db_session=None):
        """Initialize service"""
        self.db_session = db_session
        self.qh_token = qh_token or os.getenv("QH_API_TOKEN")
        
        if not self.qh_token:
            logger.error("⚠ QH_API_TOKEN not found in environment")
        else:
            logger.info(f"✓ QH_API_TOKEN loaded (length: {len(self.qh_token)})")

        self.headers = {
            "Authorization": f"Bearer {self.qh_token}",
            "Content-Type": "application/json"
        }

        # In-memory cache
        self.contracts_list = []  # List of all contracts
        self.contracts_metadata = {}  # {code: {product, type, label}}
        self.ohlc_cache = {}  # {code: ohlc_data}

    def detect_contract_type(self, code: str) -> str:
        """
        Detect contract type based on number of dashes and plus signs
        - Outright: no dashes (SRAH26)
        - Calendar: 1 dash (SRAH26-M26)
        - Butterfly: 2 dashes (SRAH26-M26-U26)
        - Condor: contains a plus sign (SRAZ26-H27-M27+U27)
        - Double Butterfly: 3+ dashes (SRAH26-M26-U26-Z26)
        """
        if '+' in code:
            return "condor"
            
        dash_count = code.count('-')
        
        if dash_count == 0:
            return "outright"
        elif dash_count == 1:
            return "calendar"
        elif dash_count == 2:
            return "butterfly"
        else:
            return "double_butterfly"

    def get_contract_label(self, code: str) -> str:
        """Generate friendly label for contract"""
        contract_type = self.detect_contract_type(code)
        
        # Map month codes to names
        month_map = {
            'F': 'Jan', 'G': 'Feb', 'H': 'Mar', 'J': 'Apr',
            'K': 'May', 'M': 'Jun', 'N': 'Jul', 'Q': 'Aug',
            'U': 'Sep', 'V': 'Oct', 'X': 'Nov', 'Z': 'Dec'
        }
        
        parts = code.split('-')
        labels = []
        
        for part in parts:
            # Extract month letter and year
            if len(part) >= 3:
                month_letter = part[-3]
                year = part[-2:]
                month_name = month_map.get(month_letter, part[-3])
                labels.append(f"{month_name}'{ year}")
        
        type_suffix = f" ({contract_type})" if contract_type != "outright" else ""
        
        return f"{code} {type_suffix}".strip()

    def _generate_mock_contracts(self) -> List[str]:
        """Generate mock contracts for testing UI when token is missing"""
        mock_contracts = []
        months = ['H', 'M', 'U', 'Z']
        years = ['25', '26', '27']
        
        for prefix in self.TARGET_PRODUCTS.values():
            for yr in years:
                for m in months:
                    # Outright
                    mock_contracts.append(f"{prefix}{m}{yr}")
            
            # Add some spreads
            mock_contracts.append(f"{prefix}H25-M25")
            mock_contracts.append(f"{prefix}H25-M25-U25")
            
        return mock_contracts

    def fetch_contracts_list(self) -> List[str]:
        """
        Fetch list of all available contracts from QuantHub
        Using /api/ohlc/products/ which returns all products
        Returns: List of contract codes
        """
        logger.info("🔄 Fetching contracts list from QuantHub...")
        
        if not self.qh_token:
            logger.warning("⚠ QH_API_TOKEN not set - Using mock data for UI testing")
            return self._generate_mock_contracts()

        try:
            logger.debug(f"GET {self.QH_PRODUCTS_ENDPOINT}")
            response = requests.get(
                self.QH_PRODUCTS_ENDPOINT,
                headers=self.headers,
                timeout=30
            )

            logger.debug(f"Status Code: {response.status_code}")

            if response.status_code == 401:
                logger.error("❌ UNAUTHORIZED - Token is invalid or expired")
                return []

            if response.status_code == 404:
                logger.error("❌ NOT FOUND - Endpoint may be incorrect")
                return []

            if response.status_code != 200:
                logger.error(f"❌ HTTP {response.status_code}")
                return []

            data = response.json()
            
            # Handle different response formats
            if isinstance(data, list):
                logger.info(f"✓ Fetched {len(data)} contracts from QuantHub (Format: List)")
                return data
            
            elif isinstance(data, dict) and "products" in data:
                contracts = data["products"]
                if isinstance(contracts, list):
                    logger.info(f"✓ Fetched {len(contracts)} contracts (Format: products key)")
                    return contracts
            
            logger.error(f"❌ Unexpected response format: {type(data)}")
            return []

        except Exception as e:
            logger.error(f"❌ Error fetching contracts: {str(e)}")
            return []

    def filter_target_contracts(self, all_contracts: List[str]) -> List[str]:
        """
        Filter contracts to only include target products
        Returns: List of contract codes for target products
        """
        filtered = []
        qh_prefixes = list(self.TARGET_PRODUCTS.values())

        for contract in all_contracts:
            for prefix in qh_prefixes:
                if contract.startswith(prefix):
                    filtered.append(contract)
                    break

        logger.info(f"✓ Filtered {len(filtered)} contracts from {len(all_contracts)} total")
        return filtered

    def build_contracts_metadata(self, contracts: List[str]) -> Dict[str, Dict]:
        """
        Build metadata dictionary for all contracts
        Returns: {code: {product, type, label}}
        """
        metadata = {}

        for code in contracts:
            # Find which product this contract belongs to
            product = None
            for prefix, prod in self.PREFIX_TO_PRODUCT.items():
                if code.startswith(prefix):
                    product = prod
                    break

            if not product:
                continue

            contract_type = self.detect_contract_type(code)
            label = self.get_contract_label(code)

            metadata[code] = {
                "code": code,
                "product": product,
                "type": contract_type,
                "label": label
            }

        logger.info(f"✓ Built metadata for {len(metadata)} contracts")
        return metadata

    def _sync_and_get_db_ohlc(self, contract_code: str, limit: int = 50):
        """
        Helper to fetch and store OHLC in DB to avoid multiple API calls.
        Returns list of OHLCData objects (latest first).
        """
        db_session = self.db_session or SessionLocal()
        if not db_session:
            return []
            
        needs_fetch = True
        instrument_id = None
        db_data = []

        instrument = db_session.query(Instrument).filter_by(instrument_code=contract_code).first()
        if not instrument:
            # Auto-create Instrument and Product
            meta = self.contracts_metadata.get(contract_code) or {}
            prod_code = meta.get('product')
            if not prod_code:
                for prefix, prod in self.PREFIX_TO_PRODUCT.items():
                    if contract_code.startswith(prefix):
                        prod_code = prod
                        break
                if not prod_code:
                    prod_code = contract_code[:3]
                    
            product = db_session.query(Product).filter_by(code=prod_code).first()
            if not product:
                qh_prefix = self.TARGET_PRODUCTS.get(prod_code, prod_code)
                product = Product(code=prod_code, name=prod_code, qh_prefix=qh_prefix)
                db_session.add(product)
                db_session.commit()
                db_session.refresh(product)
                
            instrument = Instrument(
                instrument_code=contract_code,
                product_id=product.id,
                instrument_type=meta.get('type', 'outright')
            )
            db_session.add(instrument)
            db_session.commit()
            db_session.refresh(instrument)
        
        if instrument:
            instrument_id = instrument.id
            db_data = db_session.query(OHLCData).filter_by(
                instrument_id=instrument_id, interval='1D'
            ).order_by(desc(OHLCData.qh_timestamp)).limit(limit).all()
            
            if len(db_data) >= min(14, limit):
                latest_time = db_data[0].qh_timestamp
                # If latest data is from today (or last 24h), we have enough
                if datetime.now().timestamp() * 1000 - latest_time < 86400000:
                    needs_fetch = False
                    logger.debug(f"✓ Using {len(db_data)} cached DB rows for {contract_code}")

        if needs_fetch and self.qh_token:
            logger.info(f"Downloading updated OHLC for {contract_code} from QuantHub...")
            params = {"instruments": contract_code, "interval": "1D"}
            try:
                response = requests.get(self.QH_OHLC_ENDPOINT, params=params, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and instrument_id:
                        from sqlalchemy.dialects.postgresql import insert
                        for bar in data:
                            timestamp = int(bar.get('time', 0))
                            stmt = insert(OHLCData).values(
                                instrument_id=instrument_id,
                                open_price=float(bar.get('open', 0)),
                                high_price=float(bar.get('high', 0)),
                                low_price=float(bar.get('low', 0)),
                                close_price=float(bar.get('close', 0)),
                                volume=int(bar.get('volume', 0) or 0),
                                qh_timestamp=timestamp,
                                interval='1D'
                            ).on_conflict_do_nothing(
                                index_elements=['instrument_id', 'qh_timestamp', 'interval']
                            )
                            db_session.execute(stmt)
                        db_session.commit()
                        
                        db_data = db_session.query(OHLCData).filter_by(
                            instrument_id=instrument_id, interval='1D'
                        ).order_by(desc(OHLCData.qh_timestamp)).limit(limit).all()
            except Exception as e:
                logger.error(f"❌ Error fetching updated OHLC: {str(e)}")
                
        return db_data

    def fetch_contract_ohlc(self, contract_code: str) -> Optional[Dict]:
        """
        Fetch OHLC data for a single contract
        Returns: {contract, open, high, low, close, timestamp, volume, atr_14, rvol_14, bps_change_14}
        """
        if not self.qh_token:
            logger.warning(f"⚠️ QH_API_TOKEN not set - Generating mock OHLC for {contract_code}")
            return {
                "contract": contract_code,
                "open": 99.50,
                "high": 99.65,
                "low": 99.35,
                "close": 99.45,
                "atr_14": 0.035,
                "rvol_14": 1.12,
                "timestamp": int(datetime.now().timestamp() * 1000),
                "volume": 12500,
                "atr_std_ratio": 1.5,
                "bps_change_14": 12.5,
                "fetch_time": datetime.now().isoformat()
            }

        try:
            db_data = self._sync_and_get_db_ohlc(contract_code, limit=20)
            if not db_data:
                return None
                
            latest_bar = db_data[0]
            curr_vol = int(latest_bar.volume or 0)

            # Calculate 14-day metrics
            atr_14 = 0.0
            rvol_14 = 0.0
            std_14 = 0.0
            atr_std_ratio = 0.0
            bps_change_14 = 0.0
            
            if len(db_data) > 1:
                trs = []
                closes = []
                max_days = min(14, len(db_data) - 1)
                
                for i in range(max_days):
                    curr = db_data[i]
                    prev = db_data[i + 1]
                    high = float(curr.high_price or 0)
                    low = float(curr.low_price or 0)
                    prev_close = float(prev.close_price or 0)
                    
                    tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
                    trs.append(tr)
                    closes.append(float(curr.close_price or 0))
                    
                if trs:
                    atr_14 = sum(trs) / len(trs)
                    
                volumes = [int(db_data[i].volume or 0) for i in range(1, max_days + 1)]
                avg_vol_14 = sum(volumes) / len(volumes) if volumes else 0.0
                if avg_vol_14 > 0:
                    rvol_14 = curr_vol / avg_vol_14
                    
                if len(closes) > 1:
                    mean_close = sum(closes) / len(closes)
                    variance = sum((c - mean_close) ** 2 for c in closes) / (len(closes) - 1)
                    import math
                    std_14 = math.sqrt(variance)
                    
                if std_14 > 0:
                    atr_std_ratio = atr_14 / std_14
                    
                latest_close = float(db_data[0].close_price or 0)
                historical_close = float(db_data[max_days].close_price or 0)
                bps_change_14 = latest_close - historical_close

            ohlc = {
                "contract": contract_code,
                "open": float(latest_bar.open_price or 0),
                "high": float(latest_bar.high_price or 0),
                "low": float(latest_bar.low_price or 0),
                "close": float(latest_bar.close_price or 0),
                "atr_14": round(atr_14, 4),
                "rvol_14": round(rvol_14, 2),
                "atr_std_ratio": round(atr_std_ratio, 2),
                "bps_change_14": round(bps_change_14, 2),
                "timestamp": int(latest_bar.qh_timestamp or 0),
                "volume": curr_vol,
                "fetch_time": datetime.now().isoformat()
            }
            self.ohlc_cache[contract_code] = ohlc
            return ohlc
        except Exception as e:
            logger.error(f"❌ Error fetching OHLC for {contract_code}: {str(e)}")
            return None

    def fetch_contract_volatility(self, contract_code: str) -> Optional[Dict]:
        """
        Fetch OHLC data and compute 14-day Volatility Analytics
        """
        from .RegimeAnalyzer import RegimeAnalyzer
        series = self.fetch_historical_series(contract_code, interval="1D", limit=15)
        if not series or len(series) < 2:
            return None
            
        suggestion = RegimeAnalyzer.generate_suggestion(series)
        
        bps_change = series[-1]["close"] - series[0]["close"]

        if suggestion.get("status") == "success":
            return {
                "contract": contract_code,
                "atr_14": round(suggestion["metrics"]["atr"], 4),
                "std_14": round(suggestion["metrics"]["std"], 4),
                "atr_std_ratio": round(suggestion["metrics"]["atr_std_ratio"], 2),
                "bps_change_14": round(bps_change, 2),
                "hurst": suggestion["metrics"]["hurst"],
                "z_score": suggestion["metrics"]["z_score"],
                "regime_score": suggestion["regime_score"],
                "suggested_model": suggestion["suggested_model"],
                "fetch_time": datetime.now().isoformat()
            }
            
        return None

    def fetch_historical_series(self, contract_code: str, interval: str = "1D", limit: int = 30) -> List[Dict]:
        """
        Fetch historical OHLC series for a contract to feed into RAEM Math Engine.
        Uses database cache!
        """
        if not self.qh_token:
            logger.warning(f"⚠️ QH_API_TOKEN not set - Generating mock historical series for {contract_code}")
            import random
            from datetime import timedelta
            mock_data = []
            base_price = 100.0
            for i in range(limit):
                mock_data.append({
                    "open": base_price,
                    "high": base_price + random.uniform(0.1, 0.5),
                    "low": base_price - random.uniform(0.1, 0.5),
                    "close": base_price + random.uniform(-0.2, 0.2),
                    "volume": int(random.uniform(1000, 50000)),
                    "timestamp": int((datetime.now() - timedelta(days=limit-i)).timestamp() * 1000)
                })
                base_price = mock_data[-1]["close"]
            return mock_data

        try:
            db_data = self._sync_and_get_db_ohlc(contract_code, limit=limit)
            if not db_data:
                return []
                
            # Convert DB objects to plain dicts that RegimeAnalyzer expects
            result = []
            for bar in db_data:
                result.append({
                    "open": float(bar.open_price or 0),
                    "high": float(bar.high_price or 0),
                    "low": float(bar.low_price or 0),
                    "close": float(bar.close_price or 0),
                    "volume": int(bar.volume or 0),
                    "time": int(bar.qh_timestamp or 0)
                })
                
            # Reversing to be chronological (oldest first)
            # Make sure we slice exactly to `limit` in case DB returned slightly more
            result = list(reversed(result))
            if len(result) > limit:
                result = result[-limit:]
            return result
        except Exception as e:
            logger.error(f"❌ Error fetching historical series: {str(e)}")
            return []

    def initialize_cache(self) -> Dict[str, int]:
        """
        Initialize the cache: fetch contracts list and build metadata
        Returns: {total_contracts, target_contracts, successful}
        """
        logger.info("\n" + "="*60)
        logger.info("INITIALIZING MARKET DATA CACHE")
        logger.info("="*60)

        # Step 1: Fetch all contracts
        logger.info("\n1️⃣  Fetching all contracts from QuantHub...")
        all_contracts = self.fetch_contracts_list()

        if not all_contracts:
            logger.error("❌ Failed to fetch contracts")
            return {"total_contracts": 0, "target_contracts": 0, "successful": 0}

        # Step 2: Filter to target products
        logger.info(f"\n2️⃣  Filtering to {len(self.TARGET_PRODUCTS)} target products...")
        target_contracts = self.filter_target_contracts(all_contracts)

        # Step 3: Build metadata
        logger.info(f"\n3️⃣  Building metadata for {len(target_contracts)} contracts...")
        self.contracts_metadata = self.build_contracts_metadata(target_contracts)
        self.contracts_list = list(self.contracts_metadata.keys())

        # Summary
        logger.info(f"\n4️⃣  Cache Summary:")
        logger.info(f"   Total contracts in QuantHub: {len(all_contracts)}")
        logger.info(f"   Target contracts (6 products): {len(target_contracts)}")
        logger.info(f"   Metadata built: {len(self.contracts_metadata)}")
        
        # Group by product
        by_product = {}
        for code, meta in self.contracts_metadata.items():
            product = meta["product"]
            if product not in by_product:
                by_product[product] = []
            by_product[product].append(code)
        
        for product, codes in sorted(by_product.items()):
            logger.info(f"   {product}: {len(codes)} contracts")

        logger.info("\n✅ MARKET DATA CACHE INITIALIZED")
        logger.info("="*60 + "\n")

        return {
            "total_contracts": len(all_contracts),
            "target_contracts": len(target_contracts),
            "successful": len(self.contracts_metadata)
        }

    # ========================================================================
    # PUBLIC API METHODS
    # ========================================================================

    def get_all_contracts(self) -> List[Dict]:
        """
        Get all contracts metadata
        Returns: List of {code, product, type, label}
        """
        return list(self.contracts_metadata.values())

    def get_contracts_by_product(self, product_code: str) -> List[Dict]:
        """
        Get contracts filtered by product
        Returns: List of {code, product, type, label}
        """
        result = []
        for meta in self.contracts_metadata.values():
            if meta["product"] == product_code:
                result.append(meta)
        return result

    def get_contract_metadata(self, code: str) -> Optional[Dict]:
        """
        Get metadata for a specific contract
        Returns: {code, product, type, label} or None
        """
        return self.contracts_metadata.get(code)

    def get_contract_ohlc(self, code: str) -> Optional[Dict]:
        """
        Get OHLC data for a contract (from cache or fetch)
        Returns: {contract, open, high, low, close, timestamp, volume}
        """
        # Check cache first
        if code in self.ohlc_cache:
            return self.ohlc_cache[code]
        
        # Fetch if not in cache
        return self.fetch_contract_ohlc(code)

    def get_cache_status(self) -> Dict:
        """Get cache status"""
        by_product = {}
        for code, meta in self.contracts_metadata.items():
            product = meta["product"]
            if product not in by_product:
                by_product[product] = 0
            by_product[product] += 1

        return {
            "status": "initialized",
            "total_contracts": len(self.contracts_metadata),
            "contracts_cached": len(self.ohlc_cache),
            "by_product": by_product,
            "last_updated": datetime.now().isoformat()
        }
