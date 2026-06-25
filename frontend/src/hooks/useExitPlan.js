// frontend/src/hooks/useExitPlan.js
import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export function useExitPlan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const solveExitPlan = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      // Expecting params.entry_models to be an array of model dicts from the entry solve
      // For example: Object.values(entryModels)
      const payload = {
        direction: params.direction || 'BUY',
        product: params.product || 'SR3',
        stop_price: parseFloat(params.stop_price),
        tp_price: parseFloat(params.tp_price),
        exit_mode: params.exit_mode || 'direct',
        rt_spacing_ticks: parseInt(params.rt_spacing_ticks) || 10,
        rt_lots_per_band: parseInt(params.rt_lots_per_band) || 1,
        crossing_override: params.crossing_override ? parseInt(params.crossing_override) : null,
        entry_models: params.entry_models || []
      };

      const response = await fetch(`${API_URL}/exit/solve`, {
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
        throw new Error(data.message || 'Failed to solve exit plan');
      }

      return data.results; // Returns map of model_id -> exit calculations
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { solveExitPlan, loading, error };
}