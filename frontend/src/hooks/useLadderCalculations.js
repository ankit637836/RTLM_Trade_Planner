// frontend/src/hooks/useLadderCalculations.js

export const useLadderCalculations = () => {
  /**
   * Generate equal distribution: [1, 1, 1, 1, ...]
   */
  const getEqualDistribution = (numLots) => {
    return Array(numLots).fill(1);
  };

  /**
   * Generate front-loaded distribution: [5, 4, 3, 2, 1, ...]
   * Heavy at the beginning, tapering off
   */
  const getFrontLoadedDistribution = (numLots) => {
    const distribution = [];
    for (let i = 0; i < numLots; i++) {
      // Starts at 5, decreases by 1 each level, minimum 1
      const lot = Math.max(1, 6 - i);
      distribution.push(lot);
    }
    return distribution;
  };

  /**
   * Generate back-loaded distribution: [1, 2, 3, 4, 5, ...]
   * Heavy at the end, building up
   */
  const getBackLoadedDistribution = (numLots) => {
    const distribution = [];
    for (let i = 0; i < numLots; i++) {
      // Starts at 1, increases by 1 each level, maximum 5
      const lot = Math.min(5, i + 1);
      distribution.push(lot);
    }
    return distribution;
  };

  /**
   * Generate manual distribution (default equal, user can edit)
   */
  const getManualDistribution = (numLots) => {
    return Array(numLots).fill(1);
  };

  /**
   * Get distribution array based on model type
   */
  const getDistributionByModel = (modelType, numLots) => {
    switch (modelType) {
      case 'equal':
        return getEqualDistribution(numLots);
      case 'front-loaded':
        return getFrontLoadedDistribution(numLots);
      case 'back-loaded':
        return getBackLoadedDistribution(numLots);
      case 'manual':
        return getManualDistribution(numLots);
      default:
        return getEqualDistribution(numLots);
    }
  };

  /**
   * Filter ladder prices to fit between SL and TP
   * Returns indices of prices within the SL-TP range
   */
  const getVisibleLadderRange = (ladder, slPrice, tpPrice, direction) => {
    if (direction === 'BUY') {
      // BUY: SL is below TP
      // Show prices from SL to TP
      return ladder
        .map((price, index) => ({ price, index }))
        .filter(({ price }) => price >= slPrice && price <= tpPrice)
        .map(({ index }) => index);
    } else {
      // SELL: SL is above TP (inverted)
      // Show prices from TP to SL
      return ladder
        .map((price, index) => ({ price, index }))
        .filter(({ price }) => price >= tpPrice && price <= slPrice)
        .map(({ index }) => index);
    }
  };

  /**
   * Calculate bar width percentage for visualization
   * Based on lots compared to max lots
   */
  const calculateBarWidth = (lot, maxLot) => {
    if (maxLot === 0) return 0;
    return (lot / maxLot) * 100;
  };

  /**
   * Get visual bounds information for a ladder
   * Determines SL, TP, and entry range highlighting
   */
  const getLadderBounds = (ladder, slPrice, tpPrice, direction) => {
    return {
      slPrice,
      tpPrice,
      minPrice: Math.min(slPrice, tpPrice),
      maxPrice: Math.max(slPrice, tpPrice),
      direction,
    };
  };

  /**
   * Check if a price is within entry range (between SL and TP)
   */
  const isInEntryRange = (price, slPrice, tpPrice) => {
    const min = Math.min(slPrice, tpPrice);
    const max = Math.max(slPrice, tpPrice);
    return price >= min && price <= max;
  };

  /**
   * Check if a price is at SL
   */
  const isStopLoss = (price, slPrice, tolerance = 0.0001) => {
    return Math.abs(price - slPrice) < tolerance;
  };

  /**
   * Check if a price is at TP
   */
  const isTakeProfit = (price, tpPrice, tolerance = 0.0001) => {
    return Math.abs(price - tpPrice) < tolerance;
  };

  return {
    getEqualDistribution,
    getFrontLoadedDistribution,
    getBackLoadedDistribution,
    getManualDistribution,
    getDistributionByModel,
    getVisibleLadderRange,
    calculateBarWidth,
    getLadderBounds,
    isInEntryRange,
    isStopLoss,
    isTakeProfit,
  };
};