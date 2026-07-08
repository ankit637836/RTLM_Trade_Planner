// frontend/src/components/Simulator.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../styles/ExitPlanner.css';

const Simulator = ({ formData, entryModels, activeSpec }) => {
  const [selectedModelId, setSelectedModelId] = useState('equal');
  const [exitType, setExitType] = useState('TYPE2');
  const [lowerRatio, setLowerRatio] = useState(3);
  const [upperRatio, setUpperRatio] = useState(2);
  const [levelSplitPct, setLevelSplitPct] = useState(50);
  const [maxTrips, setMaxTrips] = useState(100);
  const [zoneStartAnchor, setZoneStartAnchor] = useState('AVG'); // 'AVG', 'FILL', 'CUSTOM'
  const [customZoneStartPrice, setCustomZoneStartPrice] = useState('');

  const [simState, setSimState] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [sessionName, setSessionName] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/sessions`)
      .then(res => res.json())
      .then(data => {
        if(data.status === 'success') setSessions(data.data);
      })
      .catch(err => console.error("Error fetching sessions", err));
  }, []);

  const handleSaveSession = async () => {
    if(!sessionName || !simState) return alert("Enter session name and start simulator");
    const payload = {
      name: sessionName,
      state_payload: {
          simState,
          selectedModelId,
          exitType,
          lowerRatio,
          upperRatio,
          levelSplitPct,
          maxTrips,
          zoneStartAnchor,
          customZoneStartPrice
      }
    };
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        alert("Session saved!");
        const updated = await fetch(`${import.meta.env.VITE_API_URL}/sessions`).then(r => r.json());
        setSessions(updated.data);
        setSessionName('');
      }
    } catch(err) {
      console.error(err);
    }
  };

  const handleLoadSession = (e) => {
    const val = e.target.value;
    if (!val) {
        // Go back to default session
        resetSimulator();
        return;
    }
    const selected = sessions.find(s => s.id === parseInt(val));
    if(selected && selected.state_payload) {
        setSimState(selected.state_payload.simState);
        setSelectedModelId(selected.state_payload.selectedModelId);
        setExitType(selected.state_payload.exitType);
        setLowerRatio(selected.state_payload.lowerRatio);
        setUpperRatio(selected.state_payload.upperRatio);
        setLevelSplitPct(selected.state_payload.levelSplitPct);
        setMaxTrips(selected.state_payload.maxTrips);
        setZoneStartAnchor(selected.state_payload.zoneStartAnchor || 'AVG');
        setCustomZoneStartPrice(selected.state_payload.customZoneStartPrice || '');
        setSessionName(selected.name);
    }
  };

  const handleDeleteSession = async () => {
    const selected = sessions.find(s => s.name === sessionName);
    if (!selected) return alert("Select a saved session to delete");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${selected.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Session deleted!");
        setSessions(sessions.filter(s => s.id !== selected.id));
        setSessionName('');
      }
    } catch(err) {
      console.error(err);
    }
  };

  const isBuy = formData.direction === 'BUY';
  const interval = parseFloat(formData.interval) || 0.005;

  const getPrecision = (tickSize) => {
    if (!tickSize) return 4;
    const str = tickSize.toString();
    return str.includes('.') ? Math.max(3, str.split('.')[1].length) : 3;
  };
  const precision = getPrecision(activeSpec?.tickSize);

  const tickValue = activeSpec ? parseFloat(activeSpec.usdTickValue) : 12.5;
  const tpPrice = parseFloat(formData.tp_price);
  const stopPrice = parseFloat(formData.stop_price) || 0;
  const startPrice = parseFloat(formData.start_price);

  // Float comparison helper to avoid JS precision issues
  const closeEnough = (a, b) => Math.abs(a - b) < 0.00001;

  const distributeSmoothly = (totalLots, numLevels) => {
    const lots = new Array(numLevels).fill(0);
    if (numLevels === 0 || totalLots <= 0) return lots;
    
    const baseLots = Math.floor(totalLots / numLevels);
    const remainder = totalLots % numLevels;
    
    for (let i = 0; i < numLevels; i++) {
      lots[i] = baseLots;
    }
    
    if (remainder > 0) {
      let error = numLevels / 2;
      for (let i = 0; i < numLevels; i++) {
        error += remainder;
        if (error >= numLevels) {
          lots[i] += 1;
          error -= numLevels;
        }
      }
    }
    return lots;
  };

  // Dynamic Exit Calculator
  const calculateExits = useCallback((referencePrice, currentPrice, inventory, isRescueMode = false, numRescueLevels = 0) => {
    if (inventory <= 0) return [];
    
    let prices = [];
    if (isRescueMode) {
      let p = stopPrice;
      for (let i = 0; i < numRescueLevels; i++) {
        prices.push(isBuy ? p + (i * interval) : p - (i * interval));
      }
    } else {
      let p;
      if (isBuy) {
        p = Math.ceil((referencePrice + 1e-9) / interval) * interval;
        while (p <= currentPrice + 1e-9) { p += interval; }
        while (p <= tpPrice || closeEnough(p, tpPrice)) {
          prices.push(p);
          p += interval;
        }
      } else {
        p = Math.floor((referencePrice - 1e-9) / interval) * interval;
        while (p >= currentPrice - 1e-9) { p -= interval; }
        while (p >= tpPrice || closeEnough(p, tpPrice)) {
          prices.push(p);
          p -= interval;
        }
      }
    }

    const numLevels = prices.length;
    if (numLevels === 0) return []; // Already at or past TP

    let exits = [];

    if (exitType === 'TYPE1') {
      const distributedLots = distributeSmoothly(inventory, numLevels);
      for (let i = 0; i < numLevels; i++) {
        if (distributedLots[i] > 0) {
          // In Type 1, everything except the absolute final level acts as a range trader rebuyable
          exits.push({ price: prices[i], lots: distributedLots[i], isRangeTrader: i < numLevels - 1 });
        }
      }
    } else if (exitType === 'TYPE2') {
      const lowerHalfCount = Math.round(numLevels * (levelSplitPct / 100));
      const upperHalfCount = numLevels - lowerHalfCount;

      const numLower = lowerRatio;
      const numUpper = upperRatio;
      const totalRatio = numLower + numUpper;
      
      let lowerInventory = Math.round(inventory * (numLower / totalRatio));
      let upperInventory = inventory - lowerInventory;

      if (lowerHalfCount === 0) {
        upperInventory = inventory;
        lowerInventory = 0;
      } else if (upperHalfCount === 0) {
        lowerInventory = inventory;
        upperInventory = 0;
      }

      // In rescue mode, the zones flip! Lower becomes pure exits, Upper becomes range trader.
      const lowerIsRangeTrader = !isRescueMode;
      const upperIsRangeTrader = isRescueMode;

      // Distribute Lower (Range Trader Zone normally)
      if (lowerHalfCount > 0 && lowerInventory > 0) {
        const lowerLots = distributeSmoothly(lowerInventory, lowerHalfCount);
        for (let i = 0; i < lowerHalfCount; i++) {
          if (lowerLots[i] > 0) {
            exits.push({ price: prices[i], lots: lowerLots[i], isRangeTrader: lowerIsRangeTrader });
          }
        }
      }

      // Distribute Upper (Exit Zone normally)
      if (upperHalfCount > 0 && upperInventory > 0) {
        const offset = lowerHalfCount;
        const upperLots = distributeSmoothly(upperInventory, upperHalfCount);
        for (let i = 0; i < upperHalfCount; i++) {
          if (upperLots[i] > 0) {
            exits.push({ price: prices[offset + i], lots: upperLots[i], isRangeTrader: upperIsRangeTrader });
          }
        }
      }
    }

    return exits;
  }, [isBuy, interval, tpPrice, stopPrice, exitType, lowerRatio, upperRatio, levelSplitPct]);

  const resetSimulator = () => {
    if (!entryModels || !entryModels[selectedModelId]) return;
    
    const model = entryModels[selectedModelId];
    const initialBuys = (model.ladder || []).map((price, idx) => ({
      price: parseFloat(price),
      lots: parseInt(model.lots[idx], 10),
      isRebuy: false,
      trips: 0
    })).filter(b => b.lots > 0);
    
    // Check if start price immediately fills
    let inventory = 0;
    let avgEntryPrice = 0;
    let remainingBuys = [...initialBuys];

    const fillIdx = remainingBuys.findIndex(b => closeEnough(b.price, startPrice));
    if (fillIdx !== -1) {
      inventory = remainingBuys[fillIdx].lots;
      avgEntryPrice = startPrice;
      remainingBuys.splice(fillIdx, 1);
    }

    const initialExits = calculateExits(startPrice, startPrice, inventory);
    
    setSimState({
      currentPrice: startPrice,
      inventory,
      cycleMaxInventory: inventory,
      avgEntryPrice,
      coreAvgPrice: avgEntryPrice,
      realizedPnL: 0,
      activeBuys: remainingBuys,
      tripsCount: 0,
      initialNumLevels: initialExits.length > 0 ? initialExits.length : Math.max(1, Math.round(Math.abs(tpPrice - startPrice) / interval)),
      isRescueMode: false,
      exits: initialExits
    });
  };

  // Reset completely only on core model changes
  useEffect(() => {
    resetSimulator();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId, entryModels]);

  // Recalculate exits dynamically when config changes (without resetting inventory/price)
  useEffect(() => {
    if (!simState || simState.inventory <= 0) return;
    
    const numLevels = simState.isRescueMode ? (simState.rescueLevels || simState.initialNumLevels) : 0;
    
    setSimState(prev => {
      // Resolve reference price based on anchor type
      let resolvedReferencePrice = prev.coreAvgPrice; // Default to AVG
      if (prev.isRescueMode) {
        resolvedReferencePrice = stopPrice;
      } else if (zoneStartAnchor === 'MKT') {
        resolvedReferencePrice = prev.currentPrice;
      } else if (zoneStartAnchor === 'CUSTOM' && customZoneStartPrice !== '') {
        resolvedReferencePrice = parseFloat(customZoneStartPrice) || prev.coreAvgPrice;
      }
      
      return {
        ...prev,
        exits: calculateExits(resolvedReferencePrice, prev.currentPrice, prev.inventory, prev.isRescueMode, numLevels)
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitType, lowerRatio, upperRatio, levelSplitPct, zoneStartAnchor, customZoneStartPrice]);

  const handleTick = (moveDir) => {
    if (!simState) return;

    let newPrice;
    if (moveDir === 'UP') {
      newPrice = simState.currentPrice + interval;
    } else {
      newPrice = simState.currentPrice - interval;
    }

    let newState = { ...simState, currentPrice: newPrice };
    
    // Detect Rescue Mode Trigger
    const isStopHit = isBuy ? newPrice <= stopPrice : newPrice >= stopPrice;
    if (isStopHit && !newState.isRescueMode && newState.inventory > 0) {
      newState.isRescueMode = true;
      newState.activeBuys = []; // Cancel all remaining buys
      const rescueLevels = newState.exits.length; // Preserve the number of levels from right before hitting SL
      newState.rescueLevels = rescueLevels; // Save it to state
      newState.exits = calculateExits(stopPrice, newPrice, newState.inventory, true, rescueLevels);
    }

    // Check for Exit Fills ANYTIME price matches an exit 
    // (This fixes the bug where SL exits were ignored because the market was moving against the trade)
    const exitOrderIdx = newState.exits.findIndex(e => closeEnough(e.price, newPrice));
    if (exitOrderIdx !== -1 && newState.inventory > 0) {
      const exitOrder = newState.exits[exitOrderIdx];
      const soldLots = Math.min(exitOrder.lots, newState.inventory);
      
      // Fill Exit
      newState.inventory -= soldLots;
      if (newState.inventory === 0) {
        newState.cycleMaxInventory = 0;
      }
      exitOrder.lots -= soldLots;
      
      // Remove the exit if it's fully filled
      if (exitOrder.lots <= 0) {
        newState.exits.splice(exitOrderIdx, 1);
      }
      
      // Correct profit calculation (handles both profits and losses accurately)
      const tickDiff = (newPrice - newState.avgEntryPrice) / interval;
      const sign = isBuy ? 1 : -1;
      const profit = soldLots * tickDiff * sign * tickValue;
      newState.realizedPnL += profit;

      // Place Rebuy if range trader
      if (exitOrder.isRangeTrader && newState.tripsCount < maxTrips) {
        const rebuyPrice = isBuy ? newPrice - interval : newPrice + interval;
        newState.activeBuys.push({
          price: rebuyPrice,
          lots: soldLots,
          isRebuy: true,
          pairedExitPrice: newPrice, // Remember exactly where to put it back
          trips: newState.tripsCount + 1
        });
        newState.tripsCount += 1;
      }
    } 
    
    // Market moved AGAINST trade (DOWN for BUY, UP for SELL) -> Check for Entry Fills
    const isAgainst = (isBuy && moveDir === 'DOWN') || (!isBuy && moveDir === 'UP');
    if (isAgainst) {
      const buyOrderIdx = newState.activeBuys.findIndex(b => closeEnough(b.price, newPrice));
      if (buyOrderIdx !== -1) {
        const boughtLots = newState.activeBuys[buyOrderIdx].lots;
        const isRebuy = newState.activeBuys[buyOrderIdx].isRebuy;
        const pairedExitPrice = newState.activeBuys[buyOrderIdx].pairedExitPrice;
        
        if (newState.inventory === 0) {
          newState.cycleMaxInventory = 0;
        }
        
        let newInventory = newState.inventory + boughtLots;
        
        // Mathematical average updates on EVERY buy for correct LIFO PnL accounting
        const totalValue = (newState.inventory * newState.avgEntryPrice) + (boughtLots * newPrice);
        newState.avgEntryPrice = totalValue / newInventory;
        
        // Recalculate visual core average ONLY if pushing risk High-Water Mark
        if (newInventory > newState.cycleMaxInventory) {
          const coreExpandLots = newInventory - newState.cycleMaxInventory;
          const coreTotalValue = (newState.cycleMaxInventory * (newState.coreAvgPrice || 0)) + (coreExpandLots * newPrice);
          newState.coreAvgPrice = coreTotalValue / newInventory;
          newState.cycleMaxInventory = newInventory;
        }
        newState.inventory = newInventory;
        
        // Remove from active buys
        newState.activeBuys.splice(buyOrderIdx, 1);

        if (isRebuy) {
          // Restore the exact same exit!
          const existingExit = newState.exits.find(e => closeEnough(e.price, pairedExitPrice));
          if (existingExit) {
             existingExit.lots += boughtLots;
             existingExit.isRangeTrader = true;
          } else {
             newState.exits.push({ price: pairedExitPrice, lots: boughtLots, isRangeTrader: true });
             // Ensure it remains sorted for correct display
             newState.exits.sort((a, b) => isBuy ? a.price - b.price : b.price - a.price);
          }
        } else {
          // Core entry fill! Recalculate full exit ladder anchored to appropriate reference
          let resolvedReferencePrice = newState.coreAvgPrice;
          if (zoneStartAnchor === 'MKT') {
            resolvedReferencePrice = newPrice;
          } else if (zoneStartAnchor === 'CUSTOM' && customZoneStartPrice !== '') {
            resolvedReferencePrice = parseFloat(customZoneStartPrice) || newState.coreAvgPrice;
          }
          newState.exits = calculateExits(resolvedReferencePrice, newState.currentPrice, newState.inventory);
        }
      }
    }
    
    setSimState(newState);
  };

  if (!entryModels) {
    return <div className="status-container">Please compute entry models first.</div>;
  }

  const modelIds = Object.keys(entryModels);

  // Compute Unrealized PnL & Possible Reward
  let unrealizedPnL = 0;
  let possibleReward = simState ? simState.realizedPnL : 0;

  if (simState && simState.inventory > 0) {
    const tickDiff = (simState.currentPrice - simState.avgEntryPrice) / interval;
    const sign = isBuy ? 1 : -1;
    unrealizedPnL = simState.inventory * tickDiff * sign * tickValue;

    // Calculate Possible Reward by summing profit of all active exit orders if hit exactly once
    simState.exits.forEach(exit => {
      const exitTickDiff = Math.abs(exit.price - simState.avgEntryPrice) / interval;
      possibleReward += exit.lots * exitTickDiff * tickValue;
    });
  }

  return (
    <div className="exit-planner-container">
      {/* HEADER CONTROLS */}
      <div className="exit-config-card" style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-primary)' }}>DYNAMIC EXIT SIMULATOR</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* ROW 1 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
            <div className="rt-input-group">
              <span className="rt-label">ENTRY MODEL</span>
              <div style={{display:'flex', gap:'5px'}}>
                {modelIds.map(id => (
                  <button 
                    key={id}
                    className={`exit-mode-btn ${selectedModelId === id ? 'active' : ''}`}
                    onClick={() => setSelectedModelId(id)}
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    {id.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="rt-input-group">
              <span className="rt-label">STRATEGY</span>
              <div style={{display:'flex', gap:'5px'}}>
                <button 
                  className="exit-mode-btn active"
                  style={{ padding: '4px 8px', fontSize: '11px', cursor: 'default' }}
                >
                  ZONED EXIT
                </button>
              </div>
            </div>

            <div className="rt-input-group">
              <span className="rt-label">RANGETRADER ZONE %</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input className="rt-input" type="number" value={levelSplitPct} onChange={e => setLevelSplitPct(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} style={{ width: '50px', padding: '4px', textAlign: 'center' }} />
                <span style={{ color: 'var(--text-secondary)' }}>%</span>
              </div>
            </div>

            <div className="rt-input-group">
              <span className="rt-label">LOTS DIVISION (L:R)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input className="rt-input" type="number" value={lowerRatio} onChange={e => setLowerRatio(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: '40px', padding: '4px', textAlign: 'center' }} />
                <span style={{ color: 'var(--text-secondary)' }}>:</span>
                <input className="rt-input" type="number" value={upperRatio} onChange={e => setUpperRatio(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: '40px', padding: '4px', textAlign: 'center' }} />
              </div>
            </div>

            <div className="rt-input-group">
              <span className="rt-label">ZONE START ANCHOR</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <select className="rt-input" value={zoneStartAnchor} onChange={e => setZoneStartAnchor(e.target.value)} style={{ padding: '4px', minWidth: '120px' }}>
                  <option value="AVG">Average Price</option>
                  <option value="MKT">Market Price</option>
                  <option value="CUSTOM">Custom Price</option>
                </select>
                {zoneStartAnchor === 'CUSTOM' && (
                  <input className="rt-input" type="number" step={interval} value={customZoneStartPrice} onChange={e => setCustomZoneStartPrice(e.target.value)} style={{ width: '70px', padding: '4px' }} placeholder="Price" />
                )}
              </div>
            </div>

            <div className="rt-input-group">
              <span className="rt-label">MAX CHURNS</span>
              <input className="rt-input" type="number" value={maxTrips} onChange={e => setMaxTrips(parseInt(e.target.value)||100)} style={{width: '60px', padding: '4px', textAlign: 'center'}}/>
            </div>
          </div>

          {/* ROW 2 */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="exit-param-item" style={{display: 'flex', flexDirection: 'column', gap: '5px', width: '200px'}}>
              <label>Load Session</label>
              <select 
                className="rt-input" 
                onChange={handleLoadSession}
                value={sessions.find(s => s.name === sessionName)?.id || ""}
                style={{ padding: '4px', width: '100%' }}
              >
                <option value="" disabled>Select Session...</option>
                <option value="">-- Current Default Setup --</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {new Date(s.created_at).toLocaleString()}</option>
                ))}
              </select>
            </div>
            
            <div className="exit-param-item" style={{display: 'flex', flexDirection: 'column', gap: '5px', width: '250px'}}>
              <label>Save Session</label>
              <div style={{display: 'flex', gap: '5px'}}>
                <input 
                  type="text" 
                  className="rt-input" 
                  placeholder="Session name" 
                  value={sessionName}
                  onChange={e => setSessionName(e.target.value)}
                  style={{flex: 1, padding: '4px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)'}}
                />
                <button className="generate-btn" style={{padding: '5px 10px', fontSize: '10px'}} onClick={handleSaveSession}>SAVE</button>
                <button className="generate-btn" style={{padding: '5px 10px', fontSize: '10px', background: '#8a2b2b'}} onClick={handleDeleteSession}>X</button>
              </div>
            </div>

            <button className="md-refresh-btn" onClick={resetSimulator} style={{ marginLeft: 'auto', marginBottom: '2px' }}>
              RESET SIM
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD */}
      {simState && (
        <>
          <div className="em-grid-stats" style={{ marginBottom: '20px' }}>
            <div className="em-stat-box">
              <span className="em-stat-label">MARKET PRICE</span>
              <span className="em-stat-val" style={{color: 'var(--accent-blue)'}}>{simState.currentPrice.toFixed(4)}</span>
            </div>
            <div className="em-stat-box">
              <span className="em-stat-label">INVENTORY (LOTS)</span>
              <span className="em-stat-val">{simState.inventory}</span>
            </div>
            <div className="em-stat-box">
              <span className="em-stat-label">AVG ENTRY</span>
              <span className="em-stat-val">{simState.coreAvgPrice.toFixed(4)}</span>
            </div>
            <div className="em-stat-box">
              <span className="em-stat-label">REALIZED P&L</span>
              <span className={`em-stat-val ${simState.realizedPnL >= 0 ? 'green' : 'red'}`}>
                {simState.realizedPnL >= 0 ? '+' : '-'}${Math.abs(simState.realizedPnL).toFixed(2)}
              </span>
            </div>
            <div className="em-stat-box">
              <span className="em-stat-label">UNREALIZED P&L</span>
              <span className={`em-stat-val ${unrealizedPnL >= 0 ? 'green' : 'red'}`}>
                {unrealizedPnL >= 0 ? '+' : '-'}${Math.abs(unrealizedPnL).toFixed(2)}
              </span>
            </div>
            <div className="em-stat-box" style={{ 
              background: possibleReward >= 0 ? 'rgba(56, 189, 113, 0.1)' : 'rgba(235, 87, 87, 0.1)', 
              border: `1px solid ${possibleReward >= 0 ? 'rgba(56, 189, 113, 0.3)' : 'rgba(235, 87, 87, 0.3)'}` 
            }}>
              <span className="em-stat-label" style={{ color: possibleReward >= 0 ? 'var(--buy-color)' : 'var(--sell-color)' }}>POSSIBLE REWARD</span>
              <span className={`em-stat-val ${possibleReward >= 0 ? 'green' : 'red'}`}>
                {possibleReward >= 0 ? '+' : '-'}${Math.abs(possibleReward).toFixed(2)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '30px' }}>
            {/* SIMULATOR CONTROLS */}
            <div style={{ flex: '0 0 150px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>TICK MARKET</div>
              <button 
                onClick={() => handleTick('UP')}
                style={{
                  background: 'rgba(56, 189, 113, 0.2)', border: '1px solid var(--buy-color)', color: 'var(--buy-color)',
                  padding: '20px', borderRadius: '8px', cursor: 'pointer', fontSize: '24px', fontWeight: 'bold'
                }}
              >
                ▲ UP
              </button>
              <button 
                onClick={() => handleTick('DOWN')}
                style={{
                  background: 'rgba(235, 87, 87, 0.2)', border: '1px solid var(--sell-color)', color: 'var(--sell-color)',
                  padding: '20px', borderRadius: '8px', cursor: 'pointer', fontSize: '24px', fontWeight: 'bold'
                }}
              >
                ▼ DOWN
              </button>
            </div>

            {/* VISUAL LADDER */}
            <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <div className="ladder-header" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                <div style={{ flex: '1 1 15%', textAlign: 'center', padding: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>{isBuy ? 'TK→TP' : 'TK→SL'}</div>
                <div style={{ flex: '1 1 25%', textAlign: 'center', padding: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>BID</div>
                <div style={{ flex: '0 0 130px', textAlign: 'center', padding: '6px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)' }}>PRICE</div>
                <div style={{ flex: '1 1 25%', textAlign: 'center', padding: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>ASK</div>
                <div style={{ flex: '1 1 15%', textAlign: 'center', padding: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>{isBuy ? 'TK→SL' : 'TK→TP'}</div>
              </div>

              <div className="ladder-scroll-area" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {(() => {
                  let ladderRows = [];
                  const allPrices = [
                    tpPrice, 
                    stopPrice, 
                    simState.currentPrice,
                    ...(simState.activeBuys || []).map(b => b.price),
                    ...(simState.exits || []).map(e => e.price)
                  ];
                  let highP = Math.max(...allPrices) + interval * 3;
                  let lowP = Math.min(...allPrices) - interval * 3;
                  
                  let p = highP;
                  const totalTicks = Math.abs(highP - lowP) / interval;
                  if (totalTicks > 500) {
                    return (
                      <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--sell-color)', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.6'}}>
                        <div style={{fontSize: '24px', marginBottom: '10px'}}>⚠️</div>
                        SIMULATION RANGE TOO WIDE<br/>
                        <span style={{color: 'var(--text-secondary)'}}>The distance between Current Price and Stop Loss exceeds 500 ticks.<br/>Visual rendering paused to prevent browser crash.</span>
                      </div>
                    );
                  }

                  const maxLots = simState.inventory > 0 ? Math.max(simState.inventory, 10) : 10;

                  while (p >= lowP - 1e-9) {
                    const price = Math.round(p * 10000) / 10000;
                    const isCurrent = closeEnough(price, simState.currentPrice);
                    
                    const exitMatch = simState.exits.find(e => closeEnough(e.price, price));
                    const buyMatch = simState.activeBuys.find(b => closeEnough(b.price, price));

                    const isStop = closeEnough(price, stopPrice);
                    const isTp = closeEnough(price, tpPrice);
                    
                    const slTicks = Math.round(Math.abs(price - stopPrice) / interval);
                    const tpTicks = Math.round(Math.abs(tpPrice - price) / interval);

                    let rowClass = "ladder-row";
                    if (isStop) rowClass += " is-stop";
                    if (isTp) rowClass += " is-tp";
                    
                    let midCol = (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' }}>
                        {simState.inventory > 0 && closeEnough(price, Math.round(simState.coreAvgPrice / interval) * interval) && (
                          <div style={{ position: 'absolute', left: 4, height: '100%', display: 'flex', alignItems: 'center', transform: `translateY(${(price - simState.coreAvgPrice) / interval * 100}%)`, zIndex: 10 }}>
                            <span style={{color: 'var(--warning-amber)', fontSize: 9, fontWeight: 700}}>▶ AVG</span>
                          </div>
                        )}
                        <span className={`ladder-price ${!exitMatch && !buyMatch && !isCurrent ? 'dim' : ''}`} style={isCurrent ? {color: 'var(--accent-blue)', fontWeight: 'bold'} : {}}>{price.toFixed(precision)}</span>
                        {isCurrent && (
                          <div style={{ position: 'absolute', right: 4, display: 'flex', alignItems: 'center' }}>
                            <span style={{color: 'var(--accent-blue)', fontSize: 9, fontWeight: 700}}>MKT ◀</span>
                          </div>
                        )}
                      </div>
                    );

                    if (isStop) midCol = <span className="ladder-price marker stop">◆ STOP</span>;
                    if (isTp) midCol = <span className="ladder-price marker tp">◆ TP</span>;

                    let bidLots = 0; let bidLabel = ""; let bidIsRangeTrader = false;
                    let askLots = 0; let askLabel = ""; let askIsRangeTrader = false;

                    if (isBuy) {
                      if (buyMatch) { bidLots = buyMatch.lots; bidLabel = buyMatch.isRebuy ? 'BUY (REBUY)' : 'BUY (ENTRY)'; bidIsRangeTrader = false; }
                      if (exitMatch) { askLots = exitMatch.lots; askLabel = exitMatch.isRangeTrader ? 'SELL (CHURN)' : 'SELL (EXIT)'; askIsRangeTrader = exitMatch.isRangeTrader; }
                    } else {
                      if (exitMatch) { bidLots = exitMatch.lots; bidLabel = exitMatch.isRangeTrader ? 'BUY (CHURN)' : 'BUY (EXIT)'; bidIsRangeTrader = exitMatch.isRangeTrader; }
                      if (buyMatch) { askLots = buyMatch.lots; askLabel = buyMatch.isRebuy ? 'SELL (RESELL)' : 'SELL (ENTRY)'; askIsRangeTrader = false; }
                    }

                    const buyBaseColor = '56, 189, 113'; // Green
                    const sellBaseColor = '235, 87, 87'; // Red
                    
                    const renderBid = () => {
                      if (bidLots === 0) return null;
                      const isEntry = isBuy; // Entry is Bid if Buying
                      // Static = Dark (0.8), RangeTrader = Light (0.3), Core Entry = Medium (0.4)
                      const opacity = isEntry ? 0.4 : (bidIsRangeTrader ? 0.3 : 0.8);
                      const barFill = `rgba(${buyBaseColor}, ${opacity})`;
                      const textFill = `rgba(${buyBaseColor}, ${opacity === 0.3 ? 0.6 : 1})`;
                      return (
                        <>
                          <div className="lot-bar-container buy" style={{ width: '100%' }}>
                            <div className="lot-bar-fill buy" style={{ width: `${Math.min(100, (bidLots / maxLots) * 100)}%`, background: barFill }}></div>
                          </div>
                          <span className="lot-text buy" style={{ color: textFill }}>{bidLots}</span>
                        </>
                      );
                    };

                    const renderAsk = () => {
                      if (askLots === 0) return null;
                      const isEntry = !isBuy; // Entry is Ask if Selling
                      // Static = Dark (0.8), RangeTrader = Light (0.3), Core Entry = Medium (0.4)
                      const opacity = isEntry ? 0.4 : (askIsRangeTrader ? 0.3 : 0.8);
                      const barFill = `rgba(${sellBaseColor}, ${opacity})`;
                      const textFill = `rgba(${sellBaseColor}, ${opacity === 0.3 ? 0.6 : 1})`;
                      return (
                        <>
                          <div className="lot-bar-container sell" style={{ width: '100%' }}>
                            <div className="lot-bar-fill sell" style={{ width: `${Math.min(100, (askLots / maxLots) * 100)}%`, background: barFill }}></div>
                          </div>
                          <span className="lot-text sell" style={{ color: textFill }}>{askLots}</span>
                        </>
                      );
                    };

                    ladderRows.push(
                      <div key={price.toFixed(4)} className={rowClass} style={{ display: 'flex', position: 'relative', ...(isCurrent ? {background: 'rgba(255,255,255,0.05)'} : {}) }}>
                        <div className="ladder-col-far-left">
                          <span className="ladder-ticks">{isBuy ? tpTicks : slTicks}</span>
                        </div>
                        <div className="ladder-col-left">
                          {renderBid()}
                        </div>

                        {/* MIDDLE COLUMN (PRICE) */}
                        <div className="ladder-col-mid">
                          {midCol}
                        </div>

                        <div className="ladder-col-right">
                          {renderAsk()}
                        </div>
                        
                        {/* FAR RIGHT COLUMN (TK->SL/TP) */}
                        <div className="ladder-col-far-right">
                          <span className="ladder-ticks">{isBuy ? slTicks : tpTicks}</span>
                        </div>
                      </div>
                    );

                    p -= interval;
                  }
                  return ladderRows;
                })()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Simulator;
