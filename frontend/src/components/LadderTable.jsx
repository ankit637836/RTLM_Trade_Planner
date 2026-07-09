// frontend/src/components/LadderTable.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import '../styles/LadderTable.css';

const ManualLotInput = ({ initialLots, onChange }) => {
  const [localVal, setLocalVal] = useState(initialLots);
  const timerRef = useRef(null);

  useEffect(() => {
    setLocalVal(initialLots);
  }, [initialLots]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalVal(val);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      if (val === '') {
        onChange(0);
      } else {
        const parsed = parseInt(val, 10);
        onChange(!isNaN(parsed) && parsed >= 0 ? parsed : 0);
      }
    }, 250); // 250ms debounce for smooth typing
  };

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const parsed = parseInt(localVal, 10);
    onChange(isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  // Convert 0 to empty string for easy backspacing
  const displayVal = localVal === 0 || localVal === '0' ? '' : localVal;

  return (
    <input 
      className="manual-input" 
      type="number" 
      min="0" 
      value={displayVal} 
      onChange={handleChange} 
      onBlur={handleBlur}
    />
  );
};


const LadderTable = ({ model, formData, activeSpec, isManual, onUpdateManualLots }) => {
  const { direction } = formData;
  const isBuy = direction === 'BUY';

  // Each model carries the stop/TP it was solved against (the Dynamic Allocator
  // derives its own bounds from market data). Fall back to the form inputs.
  const stop_price = model?.stop_price !== undefined ? model.stop_price : formData.stop_price;
  const tp_price = model?.tp_price !== undefined ? model.tp_price : formData.tp_price;

  // The visual grid must use the BASE tick size (= interval / multiplier) so that
  // every possible ladder price lands on a grid row.  The detected ladder gap
  // (= interval, i.e. base tick × multiplier) is coarser and can leave ladder
  // prices stranded between grid rows.
  //
  // Exception: SOFR derivative Dynamic Allocator — its ladder is at 0.5 spacing
  // while formData still carries the outright base tick (0.005).  Using 0.005
  // across a range of 3.5→8.0 would produce 900+ rows.  In that case only, we
  // fall back to the spacing detected from the model's own ladder.
  const baseStep = formData.interval
    ? (formData.interval / (formData.interval_multiplier || 1))
    : (activeSpec?.tickSize || 0.005);

  // Detect actual spacing from the model's ladder (for the fallback path)
  const detectedStep = (() => {
    if (model?.ladder && model.ladder.length >= 2) {
      const sorted = [...model.ladder].sort((a, b) => a - b);
      let minGap = Infinity;
      for (let i = 1; i < sorted.length; i++) {
        const gap = Math.abs(sorted[i] - sorted[i - 1]);
        if (gap > 1e-9 && gap < minGap) minGap = gap;
      }
      if (isFinite(minGap) && minGap > 1e-9) return parseFloat(minGap.toFixed(6));
    }
    return baseStep;
  })();

  // Would the base step create too many rows?  If so, use the ladder's own step.
  const allPricesForRange = [tp_price, stop_price, ...(model?.ladder || [])];
  const priceRange = Math.max(...allPricesForRange) - Math.min(...allPricesForRange) + baseStep * 6;
  const step = (priceRange / baseStep > 500) ? detectedStep : baseStep;
  
  const getPrecision = (tick) => {
    if (!tick) return 4;
    const str = tick.toString();
    return str.includes('.') ? Math.max(3, str.split('.')[1].length) : 3;
  };
  const precision = getPrecision(step);
  
  // Calculate total visible range extending from SL to TP + padding
  const visibleLadder = useMemo(() => {
    if (!model || !model.ladder) return [];
    
    const ladder = [];
    
    const allPrices = [tp_price, stop_price, ...model.ladder];
    let highP = Math.max(...allPrices) + step * 3;
    let lowP = Math.min(...allPrices) - step * 3;
    
    const totalTicks = (highP - lowP) / step;
    if (totalTicks > 500) return null;
    
    let p = highP;
    while (p >= lowP - 1e-9) { 
      ladder.push(Math.round(p * 10000) / 10000); 
      p -= step; 
    }
    return ladder;
  }, [model, tp_price, stop_price, step]);

  const maxLots = model?.lots ? Math.max(...model.lots) : 1;

  const handleManualChange = (idx, parsedValue) => {
    if (!onUpdateManualLots || !model.lots) return;
    const newLots = [...model.lots];
    newLots[idx] = parsedValue;
    onUpdateManualLots(newLots);
  };

  return (
    <div className="ladder-container">
      {/* Header */}
      <div className="ladder-header" style={{ display: 'flex' }}>
        <div style={{ flex: '1 1 15%', textAlign: 'center', padding: '6px' }}>{isBuy ? 'TK→TP' : 'TK→SL'}</div>
        <div style={{ flex: '1 1 25%', textAlign: 'center', padding: '6px' }}>BID</div>
        <div style={{ flex: '0 0 130px', textAlign: 'center', padding: '6px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)' }}>PRICE</div>
        <div style={{ flex: '1 1 25%', textAlign: 'center', padding: '6px' }}>ASK</div>
        <div style={{ flex: '1 1 15%', textAlign: 'center', padding: '6px' }}>{isBuy ? 'TK→SL' : 'TK→TP'}</div>
      </div>

      {/* Scroll Area */}
      <div className="ladder-scroll-area">
        {visibleLadder === null ? (
          <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--sell-color)', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.6'}}>
            <div style={{fontSize: '24px', marginBottom: '10px'}}>⚠️</div>
            PRICE RANGE TOO WIDE<br/>
            <span style={{color: 'var(--text-secondary)'}}>The distance between TP and Stop Loss exceeds 500 ticks.<br/>Visual rendering paused to prevent browser crash.</span>
          </div>
        ) : visibleLadder.map((price) => {
          // Find if this price is an entry level in the model (tolerance match
          // to handle IEEE-754 mismatch between backend rounding and frontend grid)
          const levelIdx = model?.ladder
            ? model.ladder.findIndex(lp => Math.abs(lp - price) < step / 2)
            : -1;
          const lots = levelIdx >= 0 && model.lots ? model.lots[levelIdx] : 0;
          
          const isStop = Math.abs(price - stop_price) < 1e-9;
          const isTp = Math.abs(price - tp_price) < 1e-9;
          
          const slTicks = Math.round(Math.abs(price - stop_price) / step);
          const tpTicks = Math.round(Math.abs(tp_price - price) / step);
          
          const isAvg = Math.abs(price - (model?.avg_entry || -1)) < (step / 2);

          let rowClass = "ladder-row";
          if (lots > 0) rowClass += " has-lots";
          if (isStop) rowClass += " is-stop";
          if (isTp) rowClass += " is-tp";

          return (
            <div key={price} className={rowClass}>
              {/* FAR LEFT COLUMN (TK->TP/SL) */}
              <div className="ladder-col-far-left">
                <span className="ladder-ticks">{isBuy ? tpTicks : slTicks}</span>
              </div>

              {/* LEFT COLUMN (BID - Green / Buy) */}
              <div className="ladder-col-left">
                {isBuy && (
                  <>
                    {lots > 0 && (
                      <div className="lot-bar-container buy" style={{ width: '100%' }}>
                        <div className="lot-bar-fill buy" style={{ width: `${(lots / maxLots) * 100}%` }}></div>
                      </div>
                    )}
                    {isManual && levelIdx >= 0 ? (
                      <ManualLotInput initialLots={lots} onChange={val => handleManualChange(levelIdx, val)} />
                    ) : (
                      lots > 0 && <span className="lot-text buy">{lots}</span>
                    )}
                  </>
                )}
              </div>

              {/* CENTER COLUMN (PRICE) */}
              <div className="ladder-col-mid">
                {isStop ? <span className="ladder-price marker stop">◆ STOP</span> :
                 isTp ? <span className="ladder-price marker tp">◆ TP</span> :
                 <>
                   {isAvg && <span style={{position: 'absolute', left: 6, color: 'var(--warning-amber)', fontSize: 9, fontWeight: 700, zIndex: 5}}>▶ AVG</span>}
                   <span className={`ladder-price ${lots > 0 ? '' : 'dim'}`}>{price.toFixed(precision)}</span>
                 </>}
              </div>

              {/* RIGHT COLUMN (ASK - Red / Sell) */}
              <div className="ladder-col-right">
                {!isBuy && (
                  <>
                    {lots > 0 && (
                      <div className="lot-bar-container sell" style={{ width: '100%' }}>
                        <div className="lot-bar-fill sell" style={{ width: `${(lots / maxLots) * 100}%` }}></div>
                      </div>
                    )}
                    {isManual && levelIdx >= 0 ? (
                      <ManualLotInput initialLots={lots} onChange={val => handleManualChange(levelIdx, val)} />
                    ) : (
                      lots > 0 && <span className="lot-text sell">{lots}</span>
                    )}
                  </>
                )}
              </div>

              {/* FAR RIGHT COLUMN (TK->SL/TP) */}
              <div className="ladder-col-far-right">
                <span className="ladder-ticks">{isBuy ? slTicks : tpTicks}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LadderTable;