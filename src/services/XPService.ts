import { GameBalance } from '../config/GameBalance';

export const XPService = {
  /**
   * Calculates the XP needed to complete the current level and reach the next.
   */
  getXpNeededForLevel: (level: number): number => {
    return Math.floor(
      GameBalance.XP_PER_LEVEL_BASE * Math.pow(level, GameBalance.XP_PER_LEVEL_MULTIPLIER)
    );
  },

  /**
   * Calculates the new level and XP after adding a specific amount.
   * Handles consecutive multiple level-ups correctly.
   */
  addXp: (
    level: number,
    xp: number,
    amount: number
  ): { level: number; xp: number; leveledUp: boolean; levelsGained: number } => {
    let currentLevel = level;
    let currentXp = xp + Math.max(0, amount);
    let levelsGained = 0;

    while (true) {
      const needed = XPService.getXpNeededForLevel(currentLevel);
      if (currentXp >= needed) {
        currentXp -= needed;
        currentLevel++;
        levelsGained++;
      } else {
        break;
      }
    }

    return {
      level: currentLevel,
      xp: currentXp,
      leveledUp: levelsGained > 0,
      levelsGained,
    };
  },
};
