// frontend/src/components/ContractPicker.jsx

import React, { useState, useEffect, useMemo } from 'react';
import '../styles/ContractPicker.css';

const PRODUCTS = {
  SR3: '3M SOFR',
  SR1: '1M SOFR',
  ZQ: 'Fed Funds',
  I: 'Euribor',
  SO3: '3M SONIA',
  SA3: '3M SARON',
};

const ContractPicker = ({ 
  allContracts, 
  selectedProduct, 
  selectedContract, 
  onProductChange, 
  onContractChange,
  loading = false 
}) => {
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter contracts by selected product
  const filteredContracts = useMemo(() => {
    if (!selectedProduct || !allContracts) return [];
    
    return allContracts.filter(contract => 
      contract.product === selectedProduct &&
      (searchText === '' || contract.code.toLowerCase().includes(searchText.toLowerCase()) ||
       contract.label.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [selectedProduct, allContracts, searchText]);

  // Get current selected contract display
  const selectedContractData = useMemo(() => {
    if (!allContracts) return null;
    return allContracts.find(c => c.code === selectedContract);
  }, [allContracts, selectedContract]);

  const handleProductClick = (product) => {
    onProductChange(product);
    setSearchText('');
    setShowDropdown(false);
  };

  const handleContractSelect = (contract) => {
    onContractChange(contract.code);
    setSearchText('');
    setShowDropdown(false);
  };

  return (
    <div className="contract-picker">
      {/* PRODUCT SELECTOR */}
      <div className="product-selector">
        <label className="picker-label">Product</label>
        <div className="product-buttons">
          {Object.entries(PRODUCTS).map(([code, name]) => (
            <button
              key={code}
              className={`product-btn ${selectedProduct === code ? 'active' : ''}`}
              onClick={() => handleProductClick(code)}
              disabled={loading}
              title={name}
            >
              <span className="product-code">{code}</span>
              <span className="product-name">{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CONTRACT SELECTOR */}
      <div className="contract-selector">
        <label className="picker-label">Contract</label>
        <div className="contract-dropdown-wrapper">
          {/* Selected Contract Display */}
          <button
            className="contract-display"
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={!selectedProduct || loading}
          >
            <span className="contract-value">
              {selectedContractData ? selectedContractData.label : 'Select contract...'}
            </span>
            <span className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}>▼</span>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && selectedProduct && (
            <div className="contract-dropdown">
              {/* Search Input */}
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search contracts..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  autoFocus
                  className="search-input"
                />
                <span className="search-icon">🔍</span>
              </div>

              {/* Contract List */}
              <div className="contract-list">
                {filteredContracts.length === 0 ? (
                  <div className="empty-message">
                    No contracts found for {selectedProduct}
                  </div>
                ) : (
                  <>
                    {/* Group by type */}
                    {['outright', 'calendar', 'butterfly', 'double_butterfly'].map(type => {
                      const typeContracts = filteredContracts.filter(c => c.type === type);
                      if (typeContracts.length === 0) return null;

                      return (
                        <div key={type} className="contract-group">
                          <div className="group-header">{type.replace('_', ' ').toUpperCase()}</div>
                          {typeContracts.map(contract => (
                            <button
                              key={contract.code}
                              className={`contract-option ${
                                selectedContract === contract.code ? 'selected' : ''
                              }`}
                              onClick={() => handleContractSelect(contract)}
                            >
                              <span className="option-code">{contract.code}</span>
                              <span className="option-type">{contract.type}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer Info */}
              <div className="dropdown-footer">
                <span className="contract-count">
                  {filteredContracts.length} / {allContracts?.filter(c => c.product === selectedProduct).length || 0} contracts
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Help Text */}
        {selectedProduct && filteredContracts.length > 0 && (
          <p className="help-text">
            Found {filteredContracts.length} contract{filteredContracts.length !== 1 ? 's' : ''} for {PRODUCTS[selectedProduct]}
          </p>
        )}
      </div>

      {/* SELECTED INFO */}
      {selectedContractData && (
        <div className="selected-info">
          <div className="info-item">
            <span className="info-label">Contract:</span>
            <span className="info-value">{selectedContractData.code}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Type:</span>
            <span className="info-badge" data-type={selectedContractData.type}>
              {selectedContractData.type}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Product:</span>
            <span className="info-value">{selectedContractData.product}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractPicker;