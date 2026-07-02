// frontend/src/hooks/useTradeAPI.js

import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const useTradeAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const solveLadder = async (payload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/trades/solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  return { solveLadder, loading, error };
};
