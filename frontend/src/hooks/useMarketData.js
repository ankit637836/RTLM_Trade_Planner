// frontend/src/hooks/useMarketData.js
import { useState, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function useMarketData() {
  const [allContracts, setAllContracts] = useState([]);
  const [currentOHLC, setCurrentOHLC] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchInProgress = useRef(false);

  const fetchContractsList = useCallback(async () => {
    if (fetchInProgress.current) return;
    
    setLoading(true);
    setError(null);
    fetchInProgress.current = true;

    try {
      const response = await fetch(`${API_URL}/market/contracts`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && Array.isArray(data.contracts)) {
        setAllContracts(data.contracts);
      } else {
        throw new Error('Invalid contracts data format');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, []);

  const fetchContractOHLC = useCallback(async (contractCode) => {
    if (!contractCode) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/market/ohlc/${contractCode}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('OHLC data not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        setCurrentOHLC(data.data);
      } else {
        throw new Error('Invalid OHLC data format');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getContractsByProduct = useCallback((productCode) => {
    return allContracts.filter(c => c.product === productCode);
  }, [allContracts]);

  return {
    allContracts,
    currentOHLC,
    loading,
    error,
    fetchContractsList,
    fetchContractOHLC,
    getContractsByProduct
  };
}
