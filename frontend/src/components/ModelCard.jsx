// frontend/src/components/ModelCard.jsx
import React from 'react';
import '../styles/ModelCard.css';
import LadderTable from './LadderTable';

const ModelCard = ({ model, formData, activeSpec, isManual, onUpdateManualLots }) => {
  if (!model) return null;

  const { title, subtitle, lots, ladder, total_lots, total_risk, total_reward, avg_entry, deviation_pct, rr_ratio, risk_per_lot, reward_per_lot } = model;
  
  const isWithinTolerance = Math.abs(deviation_pct) <= formData.tolerance_pct;
  const targetRR = formData.target_reward / formData.target_risk;
  const isRRGood = rr_ratio >= targetRR;
  const isRROk = !isRRGood && rr_ratio >= targetRR * 0.85;

  const handleReset = () => {
    if (onUpdateManualLots && ladder) {
      // Reset to equal
      onUpdateManualLots(Array(ladder.length).fill(1));
    }
  };

  return (
    <div className="model-card">
      {/* Header */}
      <div className="mc-header">
        <div className="mc-title-block">
          <h4 className="mc-title">{title}</h4>
          <span className="mc-subtitle">{subtitle}</span>
        </div>
        <div className="mc-badges">
          <span className={`mc-badge ${isWithinTolerance ? 'green' : 'red'}`}>RISK {deviation_pct >= 0 ? '+' : ''}{deviation_pct.toFixed(1)}%</span>
          <span className={`mc-badge ${isRRGood ? 'green' : isRROk ? 'amber' : 'red'}`}>RR 1:{rr_ratio.toFixed(2)}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mc-stats-row">
        <div className="mc-stat-item">
          <span className="mc-stat-label">AVG ENTRY</span>
          <span className="mc-stat-val" style={{color: 'var(--warning-amber)'}}>{avg_entry.toFixed(4)}</span>
        </div>
        <div className="mc-stat-item">
          <span className="mc-stat-label">TOTAL LOTS</span>
          <span className="mc-stat-val">{total_lots}</span>
        </div>
        <div className="mc-stat-item">
          <span className="mc-stat-label">HEAT @ STOP</span>
          <span className="mc-stat-val" style={{color: 'var(--sell-color)'}}>${total_risk.toFixed(2)}</span>
        </div>
        <div className="mc-stat-item">
          <span className="mc-stat-label">REWARD @ TP</span>
          <span className="mc-stat-val" style={{color: 'var(--buy-color)'}}>${total_reward.toFixed(2)}</span>
        </div>
        <div className="mc-stat-item">
          <span className="mc-stat-label">TARGET</span>
          <span className="mc-stat-val" style={{color: 'var(--text-dim)'}}>${Number(formData.target_risk).toFixed(2) || 0}</span>
        </div>
      </div>

      {/* Order Plan */}
      <div className="mc-order-plan">
        <div className="mc-order-header">
          <span>ORDER PLAN</span>
          {isManual && <button className="mc-reset-btn" onClick={handleReset}>RESET TO EQUAL</button>}
          <span className={`mc-order-header-dir ${formData.direction.toLowerCase()}`}>{formData.direction}</span>
        </div>
        
        <div className="mc-order-table">
          {lots && ladder && lots.map((lotCount, idx) => {
            if (lotCount <= 0 && !isManual) return null;
            return (
              <div className="mc-order-row" key={idx}>
                <span className={`mc-order-val ${formData.direction.toLowerCase()}`}>{formData.direction}</span>
                <span className="mc-order-val">{lotCount}</span>
                <span className="mc-order-val dim">@</span>
                <span className="mc-order-val">{ladder[idx].toFixed(4)}</span>
                <span className="mc-order-val risk">-${(lotCount * risk_per_lot[idx]).toFixed(2)}</span>
                <span className="mc-order-val reward">+${(lotCount * reward_per_lot[idx]).toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        <div className="mc-order-summary">
          <span>Total: <span className="mc-order-summary-val">{total_lots} lots</span></span>
          <span style={{color: 'var(--border-dim)'}}>•</span>
          <span>avg <span className="mc-order-summary-val">{avg_entry.toFixed(4)}</span></span>
          <span style={{color: 'var(--border-dim)'}}>•</span>
          <span className="mc-order-val risk">-${total_risk.toFixed(2)} risk</span>
          <span className="mc-order-val reward">+${total_reward.toFixed(2)} reward</span>
          <span style={{color: 'var(--border-dim)'}}>•</span>
          <span style={{color: 'var(--accent-blue)', fontWeight: 600}}>= 1:{rr_ratio.toFixed(2)}</span>
        </div>
      </div>

      {/* DOM Ladder */}
      <LadderTable 
        model={model} 
        formData={formData} 
        activeSpec={activeSpec} 
        isManual={isManual}
        onUpdateManualLots={onUpdateManualLots}
      />
    </div>
  );
};

export default ModelCard;