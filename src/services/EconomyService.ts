export const EconomyService = {
  /**
   * Checks if player can afford the specified cost.
   */
  canAfford: (currentCoins: number, cost: number): boolean => {
    return currentCoins >= cost;
  },

  /**
   * Deducts specified cost from current coins.
   * Throws an error if funds are insufficient.
   */
  spend: (currentCoins: number, cost: number): number => {
    if (currentCoins < cost) {
      throw new Error('Insufficient coins');
    }
    return currentCoins - cost;
  },

  /**
   * Adds coins to current balance.
   */
  add: (currentCoins: number, amount: number): number => {
    return currentCoins + Math.max(0, amount);
  },

  /**
   * Refunds coins back to balance.
   */
  refund: (currentCoins: number, amount: number): number => {
    return currentCoins + Math.max(0, amount);
  },
};
