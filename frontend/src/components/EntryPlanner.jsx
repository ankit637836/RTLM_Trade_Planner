// frontend/src/components/EntryPlanner.jsx
import React from 'react';
import '../styles/EntryPlanner.css';
import ModelCard from './ModelCard';

const EntryPlanner = ({ formData, models, loading, error, onUpdateEqualLots, onUpdateFrontLots, onUpdateBackLots, onUpdateRaemLots, activeSpec, headerOHLC, raemMetrics }) => {
  if (loading && !models) {
    return <div className="status-container">Calculating models...</div>;
  }

  if (error) {
    return <div className="status-container error-container">Error: {error}</div>;
  }

  if (!models) {
    return <div className="status-container">No models calculated.</div>;
  }
  const getRegimeMessage = () => {
    if (!headerOHLC || headerOHLC.atr_std_ratio === undefined) return null;
    
    const ratio = headerOHLC.atr_std_ratio;
    const atr = headerOHLC.atr_14;
    const bps_change = headerOHLC.bps_change_20;
    const isBuy = formData.direction === 'BUY';
    const tickSize = activeSpec?.tickSize || 0.005;
    const normalizedATR = atr / tickSize;
    
    // Check Counter-Trend
    if (ratio < 1.0 && ((isBuy && bps_change < 0) || (!isBuy && bps_change > 0))) {
      return {
        type: 'warning',
        title: '⚠️ COUNTER-TREND WARNING',
        text: 'You are placing orders directly against a strong structural trend. Strongly consider Back-Loaded models with wider intervals to protect your average price, and ensure your Stop Loss is technically sound.'
      };
    }
    
    if (ratio < 1.0) {
      if (normalizedATR < 5) {
        return {
          type: 'trend-quiet',
          title: '📉 QUIET GRINDING TREND (Ratio < 1.0 | Low ATR)',
          text: 'The market is trending cleanly with very shallow intraday pullbacks. Front-Loaded models are highly recommended to ensure you get filled. Use tighter intervals.'
        };
      } else {
        return {
          type: 'trend-volatile',
          title: '⚡ VOLATILE TREND (Ratio < 1.0 | High ATR)',
          text: 'Strong structural trend, but with wild intraday swings. Equal or Front-Loaded models are preferred. You can use slightly wider intervals to absorb the noise while catching the trend.'
        };
      }
    } else {
      if (normalizedATR < 5) {
        return {
          type: 'chop-quiet',
          title: '🐢 DEAD / RANGING MARKET (Ratio > 1.0 | Low ATR)',
          text: 'Low structural progress and low daily volatility. Equal models are recommended. Back-loaded models are unlikely to get fully filled here. Keep intervals tight.'
        };
      } else {
        return {
          type: 'chop-volatile',
          title: '🌊 VIOLENT WHIPSAW (Ratio > 1.0 | High ATR)',
          text: 'Massive intraday spikes but no structural progress. This is the perfect environment for Back-Loaded models to catch deep spikes for superior average pricing. Use wider intervals.'
        };
      }
    }
  };

  const regimeMsg = getRegimeMessage();

  return (
    <div className="entry-planner-container">
      {regimeMsg && (
        <div className={`mc-regime-msg ${regimeMsg.type}`} style={{
          marginBottom: '16px',
          padding: '12px 16px',
          borderRadius: '4px',
          fontSize: '13px',
          lineHeight: '1.4',
          borderLeft: '4px solid',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: regimeMsg.type === 'warning' ? '#ff4d4d' :
                       regimeMsg.type.includes('trend') ? '#4da6ff' :
                       '#ffb84d'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '14px', color: 
            regimeMsg.type === 'warning' ? '#ff4d4d' :
            regimeMsg.type.includes('trend') ? '#4da6ff' : '#ffb84d'
          }}>{regimeMsg.title}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{regimeMsg.text}</div>
        </div>
      )}
      <div className="models-grid">
        <ModelCard 
          model={models.equal} 
          formData={formData} 
          activeSpec={activeSpec} 
          headerOHLC={headerOHLC}
          isManual={true}
          onUpdateManualLots={onUpdateEqualLots}
        />
        <ModelCard 
          model={models.front_loaded} 
          formData={formData} 
          activeSpec={activeSpec} 
          headerOHLC={headerOHLC}
          isManual={true}
          onUpdateManualLots={onUpdateFrontLots}
        />
        <ModelCard 
          model={models.back_loaded} 
          formData={formData} 
          activeSpec={activeSpec} 
          headerOHLC={headerOHLC}
          isManual={true}
          onUpdateManualLots={onUpdateBackLots}
        />
        <div>
          <ModelCard 
            model={models.raem} 
            formData={formData} 
            activeSpec={activeSpec} 
            headerOHLC={headerOHLC}
            isManual={true}
            onUpdateManualLots={onUpdateRaemLots}
          />
          {raemMetrics && (
            <div style={{
              marginTop: '15px', 
              padding: '12px', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', color: 'var(--text-secondary)' }}>RAEM MATHEMATICS</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Hurst (H)</span>
                  <span>{raemMetrics.metrics?.hurst ? raemMetrics.metrics.hurst.toFixed(2) : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>ATR/STD</span>
                  <span>{raemMetrics.metrics?.atr_std_ratio ? raemMetrics.metrics.atr_std_ratio.toFixed(2) : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Z-Score</span>
                  <span>{raemMetrics.metrics?.z_score ? raemMetrics.metrics.z_score.toFixed(2) : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Regime (RS)</span>
                  <span style={{ color: 'var(--buy-color)' }}>{raemMetrics.regime_score ? raemMetrics.regime_score.toFixed(3) : '-'}</span>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Suggests</span>
                  <span style={{ fontWeight: 'bold' }}>{raemMetrics.suggested_model ? raemMetrics.suggested_model.replace('_', ' ').toUpperCase() : '-'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryPlanner;