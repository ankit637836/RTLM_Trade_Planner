// frontend/src/components/ExitPlanner.jsx
import React, { useState, useEffect, useRef } from 'react';
import '../styles/ExitPlanner.css';
import { useExitPlan } from '../hooks/useExitPlan';

const ExitPlanner = ({ formData, entryModels, activeSpec }) => {
  const [exitMode, setExitMode] = useState('direct'); // 'direct' or 'range_trader'
  const [rtSpacingTicks, setRtSpacingTicks] = useState(10);
  const [rtLotsPerBand, setRtLotsPerBand] = useState(1);
  const [crossingOverride, setCrossingOverride] = useState('');
  
  const [results, setResults] = useState(null);
  const { solveExitPlan, loading, error } = useExitPlan();

  useEffect(() => {
    const compute = async () => {
      if (!entryModels || Object.keys(entryModels).length === 0) return;
      try {
        const res = await solveExitPlan({
          ...formData,
          exit_mode: exitMode,
          rt_spacing_ticks: rtSpacingTicks,
          rt_lots_per_band: rtLotsPerBand,
          crossing_override: crossingOverride !== '' ? parseInt(crossingOverride) : null,
          entry_models: Object.values(entryModels)
        });
        setResults(res);
      } catch(e) {
        console.error("Exit plan failed:", e);
      }
    };
    compute();
  }, [formData, entryModels, exitMode, rtSpacingTicks, rtLotsPerBand, crossingOverride, solveExitPlan]);

  if (!entryModels) {
    return <div className="status-container">Please compute entry models first.</div>;
  }

  return (
    <div className="exit-planner-container">
      {/* Configuration Header */}
      <div className="exit-config-card">
        <div className="exit-mode-toggle">
          <button 
            className={`exit-mode-btn ${exitMode === 'direct' ? 'active' : ''}`}
            onClick={() => setExitMode('direct')}
          >
            DIRECT TARGET
          </button>
          <button 
            className={`exit-mode-btn ${exitMode === 'range_trader' ? 'active' : ''}`}
            onClick={() => setExitMode('range_trader')}
          >
            RANGE TRADER
          </button>
        </div>

        {exitMode === 'range_trader' && (
          <div className="rt-config-row">
            <div className="rt-input-group">
              <span className="rt-label">Band Spacing (ticks)</span>
              <input className="rt-input" type="number" min="1" value={rtSpacingTicks} onChange={e => setRtSpacingTicks(parseInt(e.target.value)||1)} />
            </div>
            <div className="rt-input-group">
              <span className="rt-label">Lots per Band</span>
              <input className="rt-input" type="number" min="1" value={rtLotsPerBand} onChange={e => setRtLotsPerBand(parseInt(e.target.value)||1)} />
            </div>
            <div className="rt-input-group">
              <span className="rt-label">Max Crossings (Opt)</span>
              <input className="rt-input" type="number" placeholder="Auto" value={crossingOverride} onChange={e => setCrossingOverride(e.target.value)} />
            </div>
            <div className="rt-calc-display">
              P&L / RT = ${(rtLotsPerBand * rtSpacingTicks * activeSpec.usdTickValue).toFixed(0)}
            </div>
          </div>
        )}
      </div>

      {loading && !results && <div className="status-container">Calculating exits...</div>}
      {error && <div className="status-container" style={{color: 'var(--sell-color)'}}>Error: {error}</div>}

      {/* Results Grid */}
      {results && (
        <div className="exit-results-grid">
          {Object.values(results).map(res => (
            <div className="exit-model-card" key={res.model_id}>
              <h4 className="em-title">{res.model_id.toUpperCase()}</h4>
              
              {res.status === 'error' ? (
                <div className="em-grid-stats">
                  <div className="em-stat-box" style={{gridColumn: 'span 4', color: 'var(--sell-color)'}}>
                    {res.message || 'Invalid calculation parameters'}
                  </div>
                </div>
              ) : res.method === 'direct' ? (
                <div className="em-grid-stats">
                  <div className="em-stat-box">
                    <span className="em-stat-label">EXIT PRICE</span>
                    <span className="em-stat-val">{res.tp_price.toFixed(4)}</span>
                  </div>
                  <div className="em-stat-box">
                    <span className="em-stat-label">LOTS</span>
                    <span className="em-stat-val">{res.total_lots}</span>
                  </div>
                  <div className="em-stat-box">
                    <span className="em-stat-label">P&L AT TP</span>
                    <span className="em-stat-val green">+${res.pnl_at_tp.toFixed(0)}</span>
                  </div>
                  <div className="em-stat-box">
                    <span className="em-stat-label">P&L AT SL</span>
                    <span className="em-stat-val red">-${Math.abs(res.pnl_at_sl).toFixed(0)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="em-grid-stats">
                    <div className="em-stat-box">
                      <span className="em-stat-label">RT P&L (from bands)</span>
                      <span className="em-stat-val blue">+${res.total_rt_pnl.toFixed(0)}</span>
                    </div>
                    <div className="em-stat-box">
                      <span className="em-stat-label">CORE EXIT P&L</span>
                      <span className="em-stat-val green">+${res.core_pnl.toFixed(0)}</span>
                    </div>
                    <div className="em-stat-box">
                      <span className="em-stat-label">TOTAL P&L</span>
                      <span className="em-stat-val green" style={{fontSize: '16px'}}>+${res.total_pnl.toFixed(0)}</span>
                    </div>
                    <div className="em-stat-box">
                      <span className="em-stat-label">STOP LOSS</span>
                      <span className="em-stat-val red">-${Math.abs(res.stop_loss).toFixed(0)}</span>
                    </div>
                  </div>
                  
                  {res.bands && res.bands.length > 0 && (
                    <div className="rt-bands-table">
                      <div className="rt-band-header">
                        <span>{formData.direction === 'BUY' ? 'SELL LEVEL' : 'BUY LEVEL'}</span>
                        <span>{formData.direction === 'BUY' ? 'BUY BACK' : 'SELL BACK'}</span>
                        <span style={{textAlign: 'center'}}>TRIPS</span>
                        <span>P&L</span>
                      </div>
                      <div style={{maxHeight: '120px', overflowY: 'auto'}}>
                        {res.bands.map(b => (
                          <div className="rt-band-row" key={b.id}>
                            <span style={{color: formData.direction === 'BUY' ? 'var(--sell-color)' : 'var(--buy-color)'}}>{b.sell_level.toFixed(4)}</span>
                            <span style={{color: formData.direction === 'BUY' ? 'var(--buy-color)' : 'var(--sell-color)'}}>{b.buy_level.toFixed(4)}</span>
                            <span style={{textAlign: 'center', color: 'var(--text-secondary)'}}>{b.trips}</span>
                            <span style={{color: 'var(--accent-blue)'}}>${b.pnl.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Animator visual element - static placeholder for brevity unless full sim logic is added */}
                  <div className="rt-animator-area">
                    <div className="anim-controls">
                      <button className="anim-btn">▶ PLAY SIMULATION</button>
                      <div className="anim-progress-bar" style={{flex: 1}}><div className="anim-progress-fill" style={{width: '30%'}}></div></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExitPlanner;