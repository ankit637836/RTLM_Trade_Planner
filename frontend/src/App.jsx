// frontend/src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

import Sidebar from './components/Sidebar';
import EntryPlanner from './components/EntryPlanner';
import ExitPlanner from './components/ExitPlanner';
import Simulator from './components/Simulator';
import MarketData from './components/MarketData';

import { useEntryPlan } from './hooks/useEntryPlan';
import { useExitPlan } from './hooks/useExitPlan';
import { useMarketData } from './hooks/useMarketData';

function App() {
  const [productsMap, setProductsMap] = useState(null);
  const [activeTab, setActiveTab] = useState('entry');
  
  const [formData, setFormData] = useState({
    direction: "BUY",
    product: "SR3",
    start_price: 0.04,
    end_price: 0.02,
    stop_price: 0,
    tp_price: 0.06,
    interval: 0.005,
    interval_multiplier: 1,
    target_risk: 1500,
    target_reward: 1500,
    tolerance_pct: 5.0,
    solver_mode: "EXACT_RISK"
  });

  const [entryModels, setEntryModels] = useState(null);
  const [manualLots, setManualLots] = useState(null);

  const { solveEntryLadder, loading: entryLoading, error: entryError } = useEntryPlan();

  // --- TOP BAR MARKET DATA LOGIC ---
  const { 
    allContracts, 
    currentOHLC: headerOHLC, 
    error: headerError,
    fetchContractsList, 
    fetchContractOHLC: fetchHeaderOHLC,
    getContractsByProduct,
    fetchVolatilityData
  } = useMarketData();

  useEffect(() => {
    fetchContractsList();
    
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    fetch(`${API_URL}/config/products`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setProductsMap(data.products);
      })
      .catch(err => console.error("Error loading products config:", err));
  }, [fetchContractsList]);

  const [frontContractCode, setFrontContractCode] = useState(null);

  useEffect(() => {
    if (!productsMap) return;
    const activeContracts = getContractsByProduct(formData.product);
    const activeSpec = productsMap[formData.product];
    
    if (activeContracts.length > 0 && activeSpec) {
      // 1. Only consider true outrights: must match exactly `prefix + Month + YY`
      const expectedLength = activeSpec.qhPrefix.length + 3;
      const pureOutrights = activeContracts.filter(c => 
        c.type === 'outright' && 
        c.code.length === expectedLength &&
        c.code.startsWith(activeSpec.qhPrefix)
      );

      if (pureOutrights.length > 0) {
        // The user specifically wants the December (Z) contract of the current year
        const currentYear2Digit = String(new Date().getFullYear()).slice(-2);
        const targetDecContract = `${activeSpec.qhPrefix}Z${currentYear2Digit}`;

        // Look for the exact December contract first
        const decContract = pureOutrights.find(c => c.code === targetDecContract);
        
        if (decContract) {
          setFrontContractCode(decContract.code);
        } else {
          // Fallback if the December contract isn't available for some reason, pick the first pure outright
          setFrontContractCode(pureOutrights[0].code);
        }
      } else {
        setFrontContractCode(activeContracts[0].code);
      }
    } else {
      setFrontContractCode(null);
    }
  }, [formData.product, allContracts, getContractsByProduct, productsMap]);

  useEffect(() => {
    if (frontContractCode) {
      fetchHeaderOHLC(frontContractCode);
    }
  }, [frontContractCode, fetchHeaderOHLC]);
  // ---------------------------------

  // Dynamically calculate interval based on product tickSize and interval_multiplier
  useEffect(() => {
    if (!productsMap) return;
    const activeSpec = productsMap[formData.product];
    if (activeSpec) {
      const multiplier = formData.interval_multiplier || 1;
      const newInterval = activeSpec.tickSize * multiplier;
      
      if (formData.interval !== newInterval) {
        setFormData(prev => ({ ...prev, interval: newInterval }));
      }
    }
  }, [formData.product, formData.interval_multiplier, productsMap, formData.interval]);

  // Re-compute entry plan automatically on changes with a debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const compute = async () => {
        try {
          const models = await solveEntryLadder({ ...formData, manual_lots: manualLots });
          setEntryModels(models);
        } catch(e) {
          console.error("Entry calculation failed:", e);
        }
      };
      compute();
    }, 400);
    
    return () => clearTimeout(timer);
  }, [formData, manualLots, solveEntryLadder]);

  if (!productsMap) {
    return <div className="app-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '20px', letterSpacing: '2px'}}>LOADING CONFIGURATION...</div>;
  }

  const activeSpec = productsMap[formData.product];

  return (
    <div className="app-container">
      {/* HEADER BAR */}
      <header className="app-header">
        <div className="header-logo">
          <span className="header-logo-icon">▮</span>
          RTLM Futures First
          <span className="header-mode">ANALYSIS MODE</span>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <span className="header-stat-label">ACTIVE:</span>
            <span className={`header-stat-value ${formData.direction.toLowerCase()}`}>
              {formData.direction} {formData.product}
            </span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">EXCHANGE:</span>
            <span className="header-stat-value">{activeSpec.exchange}</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-label">CCY:</span>
            <span className="header-stat-value">{activeSpec.currency}</span>
          </div>
        </div>
      </header>

      {/* MARKET DATA BAR */}
      <div className="market-data-bar">
        {headerOHLC ? (
          <>
            <div className="md-left-items">
              <div className="md-item">
                <span className="md-label">FRONT</span>
                <span className="md-value" style={{color: 'var(--accent-blue)'}}>{headerOHLC.contract}</span>
              </div>
              <div className="md-item"><span className="md-label">LAST</span><span className="md-value">{headerOHLC.close.toFixed(3)}</span></div>
              <div className="md-item"><span className="md-label">OPEN</span><span className="md-value">{headerOHLC.open.toFixed(3)}</span></div>
              <div className="md-item"><span className="md-label">HIGH</span><span className="md-value" style={{color: 'var(--buy-color)'}}>{headerOHLC.high.toFixed(3)}</span></div>
              <div className="md-item"><span className="md-label">LOW</span><span className="md-value" style={{color: 'var(--sell-color)'}}>{headerOHLC.low.toFixed(3)}</span></div>
              <div className="md-item"><span className="md-label">ATR14</span><span className="md-value">{headerOHLC.atr_14 !== undefined ? headerOHLC.atr_14.toFixed(3) : '-'}</span></div>
              <div className="md-item"><span className="md-label">RVOL14</span><span className="md-value">{headerOHLC.rvol_14 !== undefined ? headerOHLC.rvol_14.toFixed(2) : '-'}</span></div>
              <div className="md-item">
                <span className="md-label">REGIME</span>
                <span className="md-value" style={{color: headerOHLC.close >= headerOHLC.open ? 'var(--buy-color)' : 'var(--sell-color)'}}>
                  {headerOHLC.close >= headerOHLC.open ? 'UPTREND' : 'DOWNTREND'} 
                  <span style={{fontSize: '10px', marginLeft: '6px', opacity: 0.8}}>
                    ({headerOHLC.close >= headerOHLC.open ? '+' : '-'}{Math.abs((headerOHLC.close - headerOHLC.open) * 100).toFixed(1)} bps)
                  </span>
                </span>
              </div>
            </div>
            <div className="md-product-center">
              {activeSpec.name}
            </div>
            <div className="md-right-items"></div>
          </>
        ) : (
          <>
            <div className="md-left-items">
              <div className="md-item">
                <span className="md-label">
                  {headerError ? `NO OHLC DATA FOR ${frontContractCode}` : 'LOADING MARKET DATA...'}
                </span>
              </div>
            </div>
            <div className="md-product-center">
              {activeSpec.name}
            </div>
            <div className="md-right-items"></div>
          </>
        )}
      </div>

      <div className="app-body">
        {/* LEFT COLUMN: SIDEBAR */}
        <div className="sidebar">
          <Sidebar 
            formData={formData} 
            setFormData={setFormData} 
            PRODUCTS={productsMap}
            allContracts={allContracts}
            fetchVolatilityData={fetchVolatilityData}
            frontContractCode={frontContractCode}
          />
        </div>

        {/* RIGHT COLUMN: TABS & CONTENT */}
        <div className="main-content-area">
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === 'entry' ? 'active' : ''}`} onClick={() => setActiveTab('entry')}>ENTRY PLAN</button>
            <button className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`} onClick={() => setActiveTab('simulator')}>EXIT SIMULATOR</button>
            <button className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`} onClick={() => setActiveTab('market')}>MARKET DATA</button>
          </div>
          
          <div className="tab-content-wrapper">
            <div style={{ display: activeTab === 'entry' ? 'block' : 'none', height: '100%' }}>
              <EntryPlanner 
                formData={formData} 
                models={entryModels} 
                loading={entryLoading} 
                error={entryError} 
                onUpdateManualLots={setManualLots} 
                activeSpec={activeSpec}
                headerOHLC={headerOHLC}
              />
            </div>
            
            <div style={{ display: activeTab === 'exit' ? 'block' : 'none', height: '100%' }}>
              <ExitPlanner 
                formData={formData}
                entryModels={entryModels}
                activeSpec={activeSpec}
              />
            </div>

            <div style={{ display: activeTab === 'simulator' ? 'block' : 'none', height: '100%' }}>
              <Simulator 
                formData={formData}
                entryModels={entryModels}
                activeSpec={activeSpec}
              />
            </div>
            
            <div style={{ display: activeTab === 'market' ? 'block' : 'none', height: '100%' }}>
              <MarketData 
                PRODUCTS={productsMap} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;