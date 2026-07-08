// frontend/src/hooks/useEntryPlan.js
import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function useEntryPlan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const solveEntryLadder = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      // Map frontend state to backend schema
      const payload = {
        direction: params.direction || 'BUY',
        product: params.product || 'SR3',
        start_price: parseFloat(params.start_price),
        end_price: parseFloat(params.end_price),
        stop_price: parseFloat(params.stop_price),
        tp_price: parseFloat(params.tp_price),
        interval: parseFloat(params.interval),
        volatility: params.volatility || 'MED',
        target_risk: parseFloat(params.target_risk),
        tolerance_pct: parseFloat(params.tolerance_pct) || 5.0,
        solver_mode: params.solver_mode || 'EXACT_RISK',
        equal_lots: params.equalLots || null,
        front_lots: params.frontLots || null,
        back_lots: params.backLots || null,
        raem_lots: params.raemLots || null,
        raem_start: params.raemBounds ? parseFloat(params.raemBounds.start_price) : null,
        raem_end: params.raemBounds ? parseFloat(params.raemBounds.end_price) : null,
        raem_stop: params.raemBounds ? parseFloat(params.raemBounds.stop_price) : null,
        raem_tp: params.raemBounds ? parseFloat(params.raemBounds.tp_price) : null,
        raem_base_shape: params.raemBaseShape || 'front_loaded'
      };

      const response = await fetch(`${API_URL}/entry/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errStr = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errStr = errData.detail || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }

      const data = await response.json();
      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to solve entry plan');
      }

      return data.models; // Returns {equal, front_loaded, back_loaded, manual}
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAutoSuggestion = useCallback(async (contractCode, lookback = 30, interval = '1D') => {
    try {
      const response = await fetch(`${API_URL}/auto-suggest/${contractCode}?interval=${interval}&lookback=${lookback}`);
      
      if (!response.ok) {
        let errStr = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errStr = errData.detail || errStr;
        } catch(e) {}
        throw new Error(errStr);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Auto-Suggest failed:", err);
      throw err;
    }
  }, []);

  return { solveEntryLadder, fetchAutoSuggestion, loading, error };
}
