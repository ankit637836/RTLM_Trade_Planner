// frontend/src/components/LadderTable.jsx
import React, { useMemo } from 'react';
import '../styles/LadderTable.css';

const LadderTable = ({ model, formData, activeSpec, isManual, onUpdateManualLots }) => {
  const { direction, stop_price, tp_price } = formData;
  const isBuy = direction === 'BUY';
  
  // Calculate total visible range extending from SL to TP + padding
  const visibleLadder = useMemo(() => {
    if (!model || !model.ladder) return [];
    
    // We want to generate a full visual ladder including TP and SL
    const ladder = [];
    const step = activeSpec.tickSize;
    let p = isBuy ? Math.max(tp_price + step*3, model.ladder[0] + step*3) : Math.min(tp_price - step*3, model.ladder[0] - step*3);
    const endP = isBuy ? stop_price - step*3 : stop_price + step*3;
    
    if (isBuy) {
      const totalTicks = (p - endP) / step;
      if (totalTicks > 500) return null;
      while (p >= endP - 1e-9) { ladder.push(Math.round(p * 10000)/10000); p -= step; }
    } else {
      const totalTicks = (endP - p) / step;
      if (totalTicks > 500) return null;
      while (p <= endP + 1e-9) { ladder.push(Math.round(p * 10000)/10000); p += step; }
    }
    return ladder;
  }, [model, tp_price, stop_price, activeSpec, isBuy]);

  const maxLots = model?.lots ? Math.max(...model.lots) : 1;

  const handleManualChange = (idx, value) => {
    if (!onUpdateManualLots || !model.lots) return;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) return;
    const newLots = [...model.lots];
    newLots[idx] = parsed;
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
          // Find if this price is an entry level in the model
          const levelIdx = model?.ladder ? model.ladder.indexOf(price) : -1;
          const lots = levelIdx >= 0 && model.lots ? model.lots[levelIdx] : 0;
          
          const isStop = Math.abs(price - stop_price) < 1e-9;
          const isTp = Math.abs(price - tp_price) < 1e-9;
          
          const slTicks = Math.round(Math.abs(price - stop_price) / activeSpec.tickSize);
          const tpTicks = Math.round(Math.abs(tp_price - price) / activeSpec.tickSize);
          
          const isAvg = Math.abs(price - (model?.avg_entry || -1)) < (activeSpec.tickSize / 2);

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
                      <input className="manual-input" type="number" min="0" value={lots} onChange={e => handleManualChange(levelIdx, e.target.value)} />
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
                   <span className={`ladder-price ${lots > 0 ? '' : 'dim'}`}>{price.toFixed(3)}</span>
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
                      <input className="manual-input" type="number" min="0" value={lots} onChange={e => handleManualChange(levelIdx, e.target.value)} />
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