// frontend/src/components/MarketData.jsx
import React, { useState, useEffect } from 'react';
import '../styles/MarketData.css';
import { useMarketData } from '../hooks/useMarketData';

const MarketData = ({ PRODUCTS }) => {
  const [activeProduct, setActiveProduct] = useState('SR3');
  const [selectedContractCode, setSelectedContractCode] = useState('');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    allContracts,
    currentOHLC,
    loading,
    error,
    fetchContractsList,
    fetchContractOHLC,
    getContractsByProduct
  } = useMarketData();

  useEffect(() => {
    // Fetch contract list on mount
    fetchContractsList();
  }, [fetchContractsList]);

  const activeContracts = getContractsByProduct(activeProduct);
  
  // Filter contracts based on search query
  const filteredContracts = activeContracts.filter(c => 
    c.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    // When product changes, select the December contract automatically
    if (activeContracts.length > 0) {
      const activeSpec = PRODUCTS[activeProduct];
      if (activeSpec) {
        const currentYear2Digit = String(new Date().getFullYear()).slice(-2);
        const targetDecPrefix = `${activeSpec.qhPrefix}Z${currentYear2Digit}`;

        // 1. Try to find the exact December outright contract
        const exactDecOutright = activeContracts.find(c => c.type === 'outright' && c.code === targetDecPrefix);
        
        if (exactDecOutright) {
          setSelectedContractCode(exactDecOutright.code);
        } else {
          // 2. If outright is not available (e.g. Energy), try to find the first calendar spread starting with the December contract
          const decSpread = activeContracts.find(c => c.type === 'calendar' && c.code.startsWith(targetDecPrefix + '-'));
          if (decSpread) {
            setSelectedContractCode(decSpread.code);
          } else {
            // 3. Fallback to the first pure outright if any
            const expectedOutrightLength = activeSpec.qhPrefix.length + 3;
            const pureOutrights = activeContracts.filter(c => c.type === 'outright' && c.code.length === expectedOutrightLength && c.code.startsWith(activeSpec.qhPrefix));
            
            if (pureOutrights.length > 0) {
               setSelectedContractCode(pureOutrights[0].code);
            } else {
               // 4. Ultimate fallback
               setSelectedContractCode(activeContracts[0].code);
            }
          }
        }
      } else {
        setSelectedContractCode(activeContracts[0].code);
      }
    } else {
      setSelectedContractCode('');
    }
    setSearchQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProduct, allContracts.length]);

  useEffect(() => {
    // Fetch OHLC when contract is selected
    if (selectedContractCode) {
      fetchContractOHLC(selectedContractCode);
    }
  }, [selectedContractCode, fetchContractOHLC]);

  const handleRefresh = () => {
    if (selectedContractCode) {
      fetchContractOHLC(selectedContractCode);
    }
  };

  return (
    <div className="md-container">
      {/* Product Selection */}
      <div className="md-product-grid">
        {Object.values(PRODUCTS).map(p => (
          <button 
            key={p.id} 
            className={`md-prod-btn ${activeProduct === p.id ? 'active' : ''}`}
            onClick={() => setActiveProduct(p.id)}
          >
            <span className="md-prod-name">{p.id}</span>
            <span className="md-prod-desc">{p.name}</span>
          </button>
        ))}
      </div>

      {/* Contract Selector */}
      <div className="md-selector-area">
        <div 
          className="md-custom-dropdown" 
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setTimeout(() => setIsDropdownOpen(false), 200);
            }
          }}
        >
          <input 
            type="text" 
            className="md-search-input"
            placeholder={selectedContractCode || "Search contracts..."}
            value={isDropdownOpen ? searchQuery : selectedContractCode}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              setIsDropdownOpen(true);
              setSearchQuery(selectedContractCode);
            }}
            disabled={activeContracts.length === 0}
          />
          
          {isDropdownOpen && (
            <div className="md-dropdown-menu">
              {['outright', 'calendar', 'butterfly', 'condor', 'double_butterfly'].map(type => {
                const items = filteredContracts.filter(c => c.type === type);
                if (items.length === 0) return null;
                return (
                  <React.Fragment key={type}>
                    <div className="md-dropdown-group-label">{type.replace('_', ' ').toUpperCase()}</div>
                    {items.map(c => (
                      <div 
                        key={c.code} 
                        className="md-dropdown-item" 
                        onClick={() => {
                          setSelectedContractCode(c.code);
                          setSearchQuery('');
                          setIsDropdownOpen(false);
                        }}
                      >
                        {c.label}
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredContracts.length === 0 && (
                <div className="md-dropdown-item" style={{color: 'var(--text-secondary)'}}>No contracts found</div>
              )}
            </div>
          )}
        </div>

        {loading && <span style={{color: 'var(--text-secondary)'}}>Loading...</span>}
        {error && <span style={{color: 'var(--sell-color)'}}>{error}</span>}

        <button className="md-refresh-btn" onClick={handleRefresh}>
          REFRESH
        </button>
      </div>

      {/* Data Layout */}
      {currentOHLC && (
        <div className="md-data-layout">
          <div className="md-panel">
            <h4 className="md-panel-title">LATEST OHLCV</h4>
            <table className="md-table">
              <tbody>
                <tr><td>OPEN</td><td>{currentOHLC.open.toFixed(4)}</td></tr>
                <tr><td>HIGH</td><td style={{color: 'var(--buy-color)'}}>{currentOHLC.high.toFixed(4)}</td></tr>
                <tr><td>LOW</td><td style={{color: 'var(--sell-color)'}}>{currentOHLC.low.toFixed(4)}</td></tr>
                <tr><td>CLOSE (LAST)</td><td>{currentOHLC.close.toFixed(4)}</td></tr>
                <tr><td>VOLUME</td><td>{currentOHLC.volume || '-'}</td></tr>
                <tr><td>TIMESTAMP</td><td style={{color: 'var(--text-dim)'}}>{new Date(currentOHLC.timestamp).toLocaleTimeString()}</td></tr>
              </tbody>
            </table>
          </div>
          
          <div className="md-panel">
            <h4 className="md-panel-title">METRICS SUMMARY</h4>
            <table className="md-table">
              <tbody>
                <tr><td>ATR (14)</td><td>{currentOHLC.atr_14 !== undefined ? currentOHLC.atr_14.toFixed(4) : '-'}</td></tr>
                <tr><td>RVOL (14)</td><td>{currentOHLC.rvol_14 !== undefined ? currentOHLC.rvol_14.toFixed(2) : '-'}</td></tr>
                <tr>
                  <td>14D CHG (Bps)</td>
                  <td style={{color: (currentOHLC.bps_change_14 >= 0) ? 'var(--buy-color)' : 'var(--sell-color)'}}>
                    {currentOHLC.bps_change_14 !== undefined ? `${currentOHLC.bps_change_14 > 0 ? '+' : ''}${currentOHLC.bps_change_14}` : '-'}
                  </td>
                </tr>
                <tr><td>ATR/STD RATIO</td><td>{currentOHLC.atr_std_ratio !== undefined ? currentOHLC.atr_std_ratio.toFixed(2) : '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketData;