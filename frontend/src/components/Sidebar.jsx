// frontend/src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import '../styles/Sidebar.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const Sidebar = ({ formData, setFormData, PRODUCTS, allContracts, frontContractCode, fetchAutoSuggestion, setRaemBounds, setRaemLots, setRaemBaseShape }) => {
  const [openCategory, setOpenCategory] = useState(PRODUCTS[formData.product]?.category || 'STIR');
  const [volSearchText, setVolSearchText] = useState('');
  const [volSelectedContract, setVolSelectedContract] = useState('');
  const [volData, setVolData] = useState(null);
  const [volLoading, setVolLoading] = useState(false);
  const [volError, setVolError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');

  // RAEM State
  const [lookbackDays, setLookbackDays] = useState(14);

  useEffect(() => {
    fetch(`${API_URL}/templates?template_type=ENTRY`)
      .then(res => res.json())
      .then(data => {
        if(data.status === 'success') setTemplates(data.data);
      })
      .catch(err => console.error("Error fetching templates", err));
  }, []);

  const handleSaveTemplate = async () => {
    if(!templateName) return alert("Enter template name");
    const payload = {
      name: templateName,
      template_type: 'ENTRY',
      payload: { ...formData, volSelectedContract }
    };
    try {
      const res = await fetch(`${API_URL}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        alert("Template saved!");
        const updated = await fetch(`${API_URL}/templates?template_type=ENTRY`).then(r => r.json());
        setTemplates(updated.data);
        setTemplateName('');
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleDeleteTemplate = async () => {
    const selected = templates.find(t => t.name === templateName);
    if (!selected) return alert("Select a saved template to delete");
    try {
      const res = await fetch(`${API_URL}/templates/${selected.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Template deleted!");
        setTemplates(templates.filter(t => t.id !== selected.id));
        setTemplateName('');
      }
    } catch(err) {
      console.error(err);
    }
  };

  // Single source of regime/volatility analytics: /api/auto-suggest.
  // Re-fetches (debounced) whenever the analyzed contract or the lookback window changes.
  useEffect(() => {
    if (!volSelectedContract || !fetchAutoSuggestion) {
      setVolData(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setVolLoading(true);
      setVolError(null);
      try {
        const data = await fetchAutoSuggestion(volSelectedContract, lookbackDays, '1D');
        if (cancelled) return;
        if (data && data.status === 'success') {
          setVolData(data);
        } else {
          setVolData(null);
          setVolError(data?.message || 'No analytics available');
        }
      } catch (e) {
        if (!cancelled) {
          setVolData(null);
          setVolError(e.message);
        }
      } finally {
        if (!cancelled) setVolLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [volSelectedContract, lookbackDays, fetchAutoSuggestion]);

  useEffect(() => {
    if (frontContractCode) {
      const activeSpec = PRODUCTS[formData.product];
      if (activeSpec && (!volSelectedContract || !volSelectedContract.startsWith(activeSpec.qhPrefix))) {
        setVolSelectedContract(frontContractCode);
        setVolSearchText(frontContractCode);
      }
    }
  }, [frontContractCode, formData.product, PRODUCTS, volSelectedContract]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field, value, fallback) => {
    setFormData(prev => {
      let parsed = parseFloat(value);
      if (isNaN(parsed)) parsed = fallback;

      if (prev[field] === parsed) {
        return prev;
      }

      const next = { ...prev, [field]: parsed };

      // Helper math to keep TP and Reward synchronized
      const avg_entry = (next.start_price + next.end_price) / 2;
      const risk_distance = Math.abs(avg_entry - next.stop_price);

      if (['target_reward', 'target_risk', 'start_price', 'end_price', 'stop_price'].includes(field)) {
        if (field === 'target_risk') {
          // By default when risk changes, set reward to match (1:1 RR)
          next.target_reward = next.target_risk;
        }

        // Auto-compute Take Profit price to maintain the current Target Reward / RR
        const target_RR = next.target_reward / next.target_risk;
        const reward_distance_input = risk_distance * target_RR;
        let raw_tp = next.direction === 'BUY' 
          ? avg_entry + reward_distance_input 
          : avg_entry - reward_distance_input;
        
        // Snap TP to grid interval
        let fallbackTick = 0.005;
        const specForTP = PRODUCTS[next.product];
        if (specForTP && (specForTP.id === 'SRA' || specForTP.id === 'SR3') && volSelectedContract && volSelectedContract.includes('-')) {
          fallbackTick = 0.5;
        }
        let interval = next.interval || fallbackTick;
        if (interval === 0.005 && fallbackTick === 0.5) interval = 0.5;
        next.tp_price = Math.round(raw_tp / interval) * interval;
        
        // Recalculate true reward based on snapped TP (directional)
        const directional_reward = next.direction === 'BUY' ? (next.tp_price - avg_entry) : (avg_entry - next.tp_price);
        const actual_RR = risk_distance > 0 ? directional_reward / risk_distance : 0;
        next.target_reward = next.target_risk * actual_RR;
      } 
      else if (field === 'tp_price') {
        let fallbackTick = 0.005;
        const specForTP = PRODUCTS[next.product];
        if (specForTP && (specForTP.id === 'SRA' || specForTP.id === 'SR3') && volSelectedContract && volSelectedContract.includes('-')) {
          fallbackTick = 0.5;
        }
        let interval = next.interval || fallbackTick;
        if (interval === 0.005 && fallbackTick === 0.5) interval = 0.5;
        next.tp_price = Math.round(next.tp_price / interval) * interval;
        
        // Auto-compute Target Reward (directional) because user manually changed TP
        const directional_reward = next.direction === 'BUY' ? (next.tp_price - avg_entry) : (avg_entry - next.tp_price);
        const actual_RR = risk_distance > 0 ? directional_reward / risk_distance : 0;
        next.target_reward = next.target_risk * actual_RR;
      }

      // Clean up floating point rounding
      if (typeof next.tp_price === 'number') next.tp_price = parseFloat(next.tp_price.toFixed(5));
      if (typeof next.target_reward === 'number') next.target_reward = parseFloat(next.target_reward.toFixed(2));

      return next;
    });
  };

  // Auto-place the DYNAMIC ALLOCATOR (4th model) whenever fresh analytics arrive.
  // The ladder is derived from market data, not from the user's manual bounds:
  //  - anchor       = last traded price of the analyzed contract
  //  - first rung   = anchor pulled back by |start_anchor_z| standard deviations
  //  - zone depth   = EME (volatility-scaled), clamped by what the risk budget can
  //                   afford: with the stop at 1.5x depth, the worst rung must still
  //                   allow ~MIN_LOTS lots inside target risk (else lots solve to 0)
  //  - rung spacing = widened so the zone holds at most MAX_RUNGS rungs
  //  - stop         = 1.5x zone depth beyond the first rung
  //  - take profit  = mirrors the user's current target RR around the est. avg entry
  //  - lot shape    = the regime-suggested model (front/equal/back loaded)
  useEffect(() => {
    if (!volData || volData.status !== 'success') return;

    const spec = PRODUCTS[formData.product];
    let tick = spec?.tickSize || 0.005;
    if (spec && (spec.id === 'SRA' || spec.id === 'SR3') && volSelectedContract && volSelectedContract.includes('-')) {
      tick = 0.5;
    } else if (volData?.tick_size) {
      tick = volData.tick_size;
    }
    const tickValue = parseFloat(spec?.usdTickValue) || 12.5;
    const gridStep = tick * (formData.interval_multiplier || 1);
    const isBuy = formData.direction === 'BUY';
    const dirSign = isBuy ? 1 : -1;
    const snap = (p) => parseFloat((Math.round(p / gridStep) * gridStep).toFixed(6));

    const lastClose = parseFloat(volData.last_close);
    const std = parseFloat(volData.metrics?.std) || 0;
    if (!isFinite(lastClose) || gridStep <= 0) return;

    const risk = parseFloat(formData.target_risk) || 0;
    const reward = parseFloat(formData.target_reward);

    // BUY waits for a pullback below last price; SELL waits for a squeeze above it
    const pullback = Math.abs(volData.start_anchor_z || 0) * std;

    // Volatility-implied zone depth...
    let emePrice = Math.max((volData.eme_ticks || 4) * tick, gridStep);
    // ...clamped by risk affordability: ticks-to-stop from the first rung is ~1.5x the
    // zone depth, and each lot there risks (ticks * tickValue). Keep room for MIN_LOTS.
    const MIN_LOTS = 5;
    if (risk > 0 && tickValue > 0) {
      const maxStopTicks = risk / (tickValue * MIN_LOTS);
      const maxEmePrice = Math.max(gridStep, (maxStopTicks / 1.5) * tick);
      emePrice = Math.min(emePrice, maxEmePrice);
    }

    // Rung spacing: at most MAX_RUNGS rungs across the zone, snapped to grid multiples
    const MAX_RUNGS = 10;
    const rungSpacing = Math.max(gridStep, Math.ceil(emePrice / MAX_RUNGS / gridStep) * gridStep);

    const start = snap(lastClose - dirSign * pullback);
    let end = snap(start - dirSign * emePrice);
    if (Math.abs(end - start) < rungSpacing) end = snap(start - dirSign * rungSpacing);
    let stop = snap(start - dirSign * 1.5 * emePrice);
    if (Math.abs(stop - start) <= Math.abs(end - start)) stop = snap(end - dirSign * gridStep);

    const avgEntry = (start + end) / 2;
    const riskDist = Math.abs(avgEntry - stop);
    const rr = risk > 0 && isFinite(reward) ? reward / risk : 1;
    const tp = snap(avgEntry + dirSign * riskDist * rr);

    if (typeof setRaemBounds === 'function') {
      setRaemBounds({ start_price: start, end_price: end, stop_price: stop, tp_price: tp, interval: rungSpacing, tick_size: tick });
    }
    if (typeof setRaemBaseShape === 'function') {
      setRaemBaseShape(volData.suggested_model);
    }
    if (typeof setRaemLots === 'function') {
      setRaemLots(null);
    }
  }, [volData, formData.direction, formData.product, formData.interval_multiplier, formData.target_risk, formData.target_reward]);

  const activeSpec = PRODUCTS[formData.product];
  const regimeScore = volData?.regime_score ?? null;

  return (
    <div className="sidebar-content">
      {/* PRODUCT */}
      <div className="section">
        <h3 className="section-title">PRODUCT</h3>
        {/* STIR Accordion Header */}
        <div 
          onClick={() => setOpenCategory(openCategory === 'STIR' ? null : 'STIR')}
          style={{ 
            marginBottom: '10px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, 
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px'
          }}
        >
          <span>A. STIR - Fixed Income Products</span>
          <span>{openCategory === 'STIR' ? '▲' : '▼'}</span>
        </div>
        
        {openCategory === 'STIR' && (
          <div className="btn-grid-3" style={{ marginBottom: '15px' }}>
            {Object.keys(PRODUCTS).filter(p => PRODUCTS[p].category === 'STIR').map(p => (
              <button 
                key={p}
                className={`toggle-btn prod-btn ${formData.product === p ? 'active-blue' : ''}`}
                onClick={() => handleChange('product', p)}
              >
                {p}
                <span className="prod-exc">{PRODUCTS[p].exchange}</span>
              </button>
            ))}
          </div>
        )}
        
        {/* Energy Accordion Header */}
        <div 
          onClick={() => setOpenCategory(openCategory === 'Energy' ? null : 'Energy')}
          style={{ 
            marginBottom: '10px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, 
            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px'
          }}
        >
          <span>B. Energy</span>
          <span>{openCategory === 'Energy' ? '▲' : '▼'}</span>
        </div>
        
        {openCategory === 'Energy' && (
          <div className="btn-grid-3">
            {Object.keys(PRODUCTS).filter(p => PRODUCTS[p].category === 'Energy').map(p => (
              <button 
                key={p}
                className={`toggle-btn prod-btn ${formData.product === p ? 'active-blue' : ''}`}
                onClick={() => handleChange('product', p)}
              >
                {p}
                <span className="prod-exc">{PRODUCTS[p].exchange}<br/><span style={{fontSize: '9px', opacity: 0.6}}>{PRODUCTS[p].currency}/{PRODUCTS[p].id === 'G' ? 'MT' : PRODUCTS[p].id === 'HO' || PRODUCTS[p].id === 'RB' ? 'gal' : PRODUCTS[p].id === 'NG' ? 'MMBtu' : 'bbl'}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CONTRACT SPECS */}
      <div className="section">
        <h3 className="section-title">CONTRACT SPECS</h3>
        <div className="specs-grid">
          <div className="spec-box">
            <span className="spec-label">Tick Size</span>
            <span className="spec-val">{(activeSpec && (activeSpec.id === 'SRA' || activeSpec.id === 'SR3') && volSelectedContract && volSelectedContract.includes('-')) ? 0.5 : activeSpec?.tickSize}</span>
          </div>
          <div className="spec-box">
            <span className="spec-label">Tick Value</span>
            <span className="spec-val">{activeSpec.tickValue} {activeSpec.currency}</span>
          </div>
          <div className="spec-box">
            <span className="spec-label">FX Rate</span>
            <span className="spec-val">{activeSpec.fxRate}</span>
          </div>
          <div className="spec-box">
            <span className="spec-label">USD Tick Value</span>
            <span className="spec-val highlight">${activeSpec.usdTickValue}</span>
          </div>
        </div>
      </div>

      {/* VOLATILITY & REGIME (RAEM) — single source of analytics, auto-drives the DYNAMIC ALLOCATOR */}
      <div className="section" style={{ backgroundColor: 'rgba(77, 166, 255, 0.05)', border: '1px solid rgba(77, 166, 255, 0.2)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
        <h3 className="section-title" style={{ color: 'var(--accent-blue)', display: 'flex', justifyContent: 'space-between' }}>
          <span>🤖 VOLATILITY & REGIME (RAEM)</span>
          {regimeScore !== null && (
            <span style={{ fontSize: '10px', color: regimeScore < 0.4 ? 'var(--buy-color)' : regimeScore > 0.6 ? 'var(--sell-color)' : 'var(--text-secondary)' }}>
              RS: {regimeScore}
            </span>
          )}
        </h3>

        <div style={{ marginBottom: '8px' }}>
          <input
            type="text"
            list="vol-contracts"
            className="num-input"
            placeholder={`Search contract... e.g. ${frontContractCode || 'SRAZ26'}`}
            value={volSearchText}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setVolSearchText(val);
              if (allContracts && allContracts.some(c => c.code === val)) {
                setVolSelectedContract(val);
              }
            }}
            onBlur={() => {
              if (volSearchText !== volSelectedContract) setVolSelectedContract(volSearchText);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && volSearchText !== volSelectedContract) {
                setVolSelectedContract(volSearchText);
              }
            }}
            style={{ width: '100%', textAlign: 'left', paddingLeft: '8px' }}
          />
          <datalist id="vol-contracts">
            {allContracts
              ?.filter(c => !volSearchText || c.code.startsWith(volSearchText))
              .map(c => <option key={c.code} value={c.code} />)}
          </datalist>
        </div>

        <div className="input-grid" style={{ marginBottom: '8px' }}>
          <div className="input-group">
            <span className="input-label">Lookback (Days)</span>
            <input className="num-input" type="number" min="5" max="60" value={lookbackDays}
                   onChange={e => setLookbackDays(Math.max(5, Math.min(60, parseInt(e.target.value) || 14)))} />
          </div>
          <div className="input-group">
            <span className="input-label">Last Close</span>
            <div className="rr-display">
              <span className="rr-val">{volLoading ? '...' : (volData?.last_close != null ? volData.last_close.toFixed(4) : '-')}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <div className="spec-box" style={{ flex: '1 1 45%', padding: '6px' }}>
            <span className="spec-label" style={{ fontSize: '9px' }}>{lookbackDays}D ATR</span>
            <span className="spec-val" style={{ fontSize: '11px' }}>
              {volLoading ? '...' : (volData?.metrics?.atr != null ? volData.metrics.atr : '-')}
            </span>
          </div>
          <div className="spec-box" style={{ flex: '1 1 45%', padding: '6px' }}>
            <span className="spec-label" style={{ fontSize: '9px' }}>{lookbackDays}D STD DEV</span>
            <span className="spec-val" style={{ fontSize: '11px' }}>
              {volLoading ? '...' : (volData?.metrics?.std != null ? volData.metrics.std : '-')}
            </span>
          </div>
          <div className="spec-box" style={{ flex: '1 1 45%', padding: '6px' }}>
            <span className="spec-label" style={{ fontSize: '9px' }}>ATR / STD</span>
            <span className="spec-val" style={{ fontSize: '11px' }}>
              {volLoading ? '...' : (volData?.metrics?.atr_std_ratio != null ? volData.metrics.atr_std_ratio : '-')}
            </span>
          </div>
          <div className="spec-box" style={{ flex: '1 1 45%', padding: '6px' }}>
            <span className="spec-label" style={{ fontSize: '9px' }}>{lookbackDays}D Bps Δ</span>
            <span className="spec-val" style={{ fontSize: '11px', color: (volData?.metrics?.bps_change >= 0) ? 'var(--buy-color)' : (volData?.metrics?.bps_change < 0 ? 'var(--sell-color)' : 'inherit') }}>
              {volLoading ? '...' : (volData?.metrics?.bps_change != null ? `${volData.metrics.bps_change > 0 ? '+' : ''}${volData.metrics.bps_change}` : '-')}
            </span>
          </div>
          <div className="spec-box" style={{ flex: '1 1 45%', padding: '6px' }}>
            <span className="spec-label" style={{ fontSize: '9px' }}>Hurst (H)</span>
            <span className="spec-val" style={{ fontSize: '11px', color: volData?.metrics?.hurst < 0.5 ? 'var(--sell-color)' : 'var(--buy-color)' }}>
              {volLoading ? '...' : (volData?.metrics?.hurst != null ? volData.metrics.hurst.toFixed(3) : '-')}
            </span>
          </div>
          <div className="spec-box" style={{ flex: '1 1 45%', padding: '6px' }}>
            <span className="spec-label" style={{ fontSize: '9px' }}>Z-Score</span>
            <span className="spec-val" style={{ fontSize: '11px' }}>
              {volLoading ? '...' : (volData?.metrics?.z_score != null ? volData.metrics.z_score.toFixed(3) : '-')}
            </span>
          </div>
          <div className="spec-box" style={{ flex: '1 1 100%', padding: '6px' }}>
            <span className="spec-label" style={{ fontSize: '9px' }}>REGIME SCORE (RS)</span>
            <span className="spec-val" style={{ fontSize: '12px', fontWeight: 'bold' }}>
              {volLoading ? '...' : (regimeScore != null ? `${regimeScore.toFixed(3)} → ${volData.suggested_model}` : '-')}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '8px', fontSize: '10px', color: volError ? 'var(--sell-color)' : 'var(--text-secondary)' }}>
          {volError
            ? `Analytics failed: ${volError}`
            : (volData
                ? `✓ Auto-applied to DYNAMIC ALLOCATOR (${(volData.suggested_model || '').replace('_', '-')}, EME ${volData.eme_ticks} ticks)`
                : 'Select a contract to compute regime analytics.')}
        </div>
      </div>

      {/* DIRECTION */}
      <div className="section">
        <h3 className="section-title">DIRECTION</h3>
        <div className="btn-grid-2">
          <button 
            className={`toggle-btn ${formData.direction === 'BUY' ? 'active-buy' : ''}`}
            onClick={() => {
              if (formData.direction !== 'BUY') {
                setFormData(prev => ({
                  ...prev,
                  direction: 'BUY',
                  start_price: 0.04,
                  end_price: 0.02,
                  stop_price: 0.00,
                  tp_price: 0.06,
                  target_risk: 1500,
                  target_reward: 1500,
                  tolerance_pct: 5.0,
                  volatility: 'MED'
                }));
              }
            }}
          >BUY</button>
          <button 
            className={`toggle-btn ${formData.direction === 'SELL' ? 'active-sell' : ''}`}
            onClick={() => {
              if (formData.direction !== 'SELL') {
                setFormData(prev => ({
                  ...prev,
                  direction: 'SELL',
                  start_price: 0.02,
                  end_price: 0.04,
                  stop_price: 0.06,
                  tp_price: 0.00,
                  target_risk: 1500,
                  target_reward: 1500,
                  tolerance_pct: 5.0,
                  volatility: 'MED'
                }));
              }
            }}
          >SELL</button>
        </div>
      </div>
      
      {/* PRICES */}
      <div className="section">
        <h3 className="section-title">PRICES</h3>
        <div className="input-grid" style={{marginBottom: '6px'}}>
          <div className="input-group">
            <span className="input-label">Start Price</span>
            <input className="num-input" type="text" value={formData.start_price} 
                   onChange={e => handleChange('start_price', e.target.value)}
                   onBlur={e => handleBlur('start_price', e.target.value, 99.5)} />
          </div>
          <div className="input-group">
            <span className="input-label">End Price</span>
            <input className="num-input" type="text" value={formData.end_price} 
                   onChange={e => handleChange('end_price', e.target.value)}
                   onBlur={e => handleBlur('end_price', e.target.value, 99.4)} />
          </div>
        </div>
        <div className="input-grid">
          <div className="input-group">
            <span className="input-label">Stop Loss</span>
            <input className="num-input" type="text" value={formData.stop_price} 
                   onChange={e => handleChange('stop_price', e.target.value)}
                   onBlur={e => handleBlur('stop_price', e.target.value, 99.3)} />
          </div>
          <div className="input-group">
            <span className="input-label">Take Profit</span>
            <input className="num-input" type="text" value={formData.tp_price} 
                   onChange={e => handleChange('tp_price', e.target.value)}
                   onBlur={e => handleBlur('tp_price', e.target.value, 100.0)} />
          </div>
        </div>
      </div>

      {/* INTERVAL GAP */}
      <div className="section">
        <h3 className="section-title">INTERVAL GAP</h3>
        <div className="specs-grid">
          <div className="spec-box">
            <span className="spec-label">Ticks Multiplier</span>
            <input 
               className="spec-val" 
               type="number" min="1" step="1" 
               value={formData.interval_multiplier} 
               onChange={e => handleChange('interval_multiplier', parseInt(e.target.value) || 1)}
               onBlur={e => handleBlur('interval_multiplier', e.target.value, 1)} 
               style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0 }}
            />
          </div>
          <div className="spec-box">
            <span className="spec-label">Interval Value</span>
            <span className="spec-val">{formData.interval}</span>
          </div>
        </div>
      </div>

      {/* RISK / REWARD */}
      <div className="section">
        <h3 className="section-title">RISK / REWARD</h3>
        <div className="input-grid">
          <div className="input-group">
            <span className="input-label">Target Risk ($)</span>
            <input className="num-input" type="text" value={formData.target_risk} 
                   onChange={e => handleChange('target_risk', e.target.value)}
                   onBlur={e => handleBlur('target_risk', e.target.value, 1500)} />
          </div>
          <div className="input-group">
            <span className="input-label">Target Reward ($)</span>
            <input className="num-input" type="text" value={formData.target_reward} 
                   onChange={e => handleChange('target_reward', e.target.value)}
                   onBlur={e => handleBlur('target_reward', e.target.value, 1500)} />
          </div>
          <div className="input-group">
            <span className="input-label">Tolerance (%)</span>
            <input className="num-input" type="text" value={formData.tolerance_pct} 
                   onChange={e => handleChange('tolerance_pct', e.target.value)}
                   onBlur={e => handleBlur('tolerance_pct', e.target.value, 5.0)} />
          </div>
          <div className="input-group">
            <span className="input-label">TARGET RR</span>
            <div className="rr-display">
              <span className="rr-val">1:{(formData.target_reward / formData.target_risk).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TEMPLATES */}
      <div className="section">
        <h3 className="section-title">TEMPLATES</h3>
        <div style={{display: 'flex', gap: '5px', marginBottom: '10px'}}>
          <select 
            className="num-input" 
            style={{flex: 1}}
            onChange={(e) => {
              const selected = templates.find(t => t.id === parseInt(e.target.value));
              if(selected) {
                setTemplateName(selected.name);
                const { volSelectedContract: savedVol, ...restForm } = selected.payload;
                setFormData(restForm);
                if (savedVol) {
                  setVolSelectedContract(savedVol);
                  setVolSearchText(savedVol);
                }
              }
            }}
            value={templates.find(t => t.name === templateName)?.id || ""}
          >
            <option value="" disabled>Load Template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{display: 'flex', gap: '5px'}}>
          <input 
            type="text" 
            className="num-input" 
            placeholder="Template name" 
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            style={{flex: 1}}
          />
          <button className="ai-btn" onClick={handleSaveTemplate}>SAVE</button>
          <button className="ai-btn" style={{background: '#8a2b2b', padding: '4px 8px'}} onClick={handleDeleteTemplate}>X</button>
        </div>
      </div>

      {/* AI PROMPT */}
      <div className="section">
        <h3 className="section-title" style={{color: 'var(--accent-blue)'}}>AI PROMPT</h3>
        <div className="ai-prompt">
          <textarea 
            className="ai-textarea" 
            placeholder="Type your strategy here..."
            defaultValue="I want to buy SR3 starting from 0.04 till 0.02 with a stop loss of 0 and target of 0.06."
          />
          <button className="ai-btn">APPLY</button>
        </div>
      </div>

    </div>
  );
};

export default Sidebar;