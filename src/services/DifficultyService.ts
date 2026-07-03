import { Difficulty } from '../domain/types';

export interface PlayerStats {
  winStreak: number;
  consecutiveFails: number; // restarts/quits count
  lastPerformanceScores: number[]; // history of last few levels
}

export const DifficultyService = {
  /**
   * Redefined campaign level bounds mapping.
   */
  getDifficultyForLevel: (levelId: number): Difficulty => {
    if (levelId <= 3) return 'easy'; // Tutorial (Levels 1-3)
    if (levelId <= 7) return 'easy'; // Easy (Levels 4-7)
    if (levelId <= 15) return 'normal'; // Medium (Levels 8-15)
    if (levelId <= 30) return 'hard'; // Hard (Levels 16-30)
    return 'expert'; // Expert (Levels 31+)
  },

  /**
   * Gets target time in seconds for a specific difficulty level.
   */
  getTargetTimeForDifficulty: (difficulty: Difficulty): number => {
    switch (difficulty) {
      case 'easy':
        return 45;
      case 'normal':
        return 90;
      case 'hard':
        return 180;
      case 'expert':
        return 300;
      case 'impossible':
        return 420;
    }
  },

  /**
   * Calculates a performance score (0 - 120) based on moves, time, restarts, and hints.
   */
  calculatePerformanceScore: (
    movesTaken: number,
    optimalMoves: number,
    timeTaken: number,
    difficulty: Difficulty,
    restarts: number,
    hintsUsed: boolean
  ): number => {
    let score = 100;

    // 1. Move efficiency (comparing to optimal AI Moves)
    const moveRatio = movesTaken / Math.max(1, optimalMoves);
    if (moveRatio <= 1.0) {
      score += 15; // perfect score bonus
    } else {
      score -= Math.min(40, (moveRatio - 1.0) * 50); // deduct for excessive moves
    }

    // 2. Time efficiency
    const targetTime = DifficultyService.getTargetTimeForDifficulty(difficulty);
    const timeRatio = timeTaken / Math.max(1, targetTime);
    if (timeRatio <= 0.8) {
      score += 10; // fast completion bonus
    } else if (timeRatio > 1.2) {
      score -= Math.min(30, (timeRatio - 1.2) * 20); // deduct for slow completion
    }

    // 3. Penalty for using hints
    if (hintsUsed) {
      score -= 25;
    }

    // 4. Penalty for restarts
    if (restarts > 0) {
      score -= Math.min(30, restarts * 15);
    }

    return Math.max(0, Math.min(120, Math.floor(score)));
  },

  /**
   * Scheduler deciding the final difficulty tier for the next level.
   */
  getNextDifficulty: (
    levelId: number,
    playerStats: PlayerStats
  ): Difficulty => {
    const baseDifficulty = DifficultyService.getDifficultyForLevel(levelId);
    
    // We only adjust difficulty starting from campaign level 4 (post tutorial)
    if (levelId <= 3) {
      return 'easy';
    }

    const { winStreak, consecutiveFails, lastPerformanceScores } = playerStats;

    // Tier ranking to help transition difficulties
    const difficultyTiers: Difficulty[] = ['easy', 'normal', 'hard', 'expert', 'impossible'];
    const currentTierIdx = difficultyTiers.indexOf(baseDifficulty);

    // 1. If player is failing repeatedly, lower the difficulty to prevent frustration
    if (consecutiveFails >= 2 && currentTierIdx > 0) {
      console.info(`[DifficultyService] Player failing. Decreasing difficulty from ${baseDifficulty} to ${difficultyTiers[currentTierIdx - 1]}`);
      return difficultyTiers[currentTierIdx - 1];
    }

    // 2. If player is performing exceptionally well (average score > 85 on last 2 matches)
    if (lastPerformanceScores.length >= 2) {
      const recentAvg = lastPerformanceScores.slice(-2).reduce((a, b) => a + b, 0) / 2;
      
      if (recentAvg >= 85 && winStreak >= 2 && currentTierIdx < difficultyTiers.length - 1) {
        console.info(`[DifficultyService] High performance (${recentAvg}). Increasing difficulty from ${baseDifficulty} to ${difficultyTiers[currentTierIdx + 1]}`);
        return difficultyTiers[currentTierIdx + 1];
      }

      // 3. If performance is low, lower difficulty
      if (recentAvg < 50 && currentTierIdx > 0) {
        console.info(`[DifficultyService] Low performance (${recentAvg}). Decreasing difficulty from ${baseDifficulty} to ${difficultyTiers[currentTierIdx - 1]}`);
        return difficultyTiers[currentTierIdx - 1];
      }
    }

    return baseDifficulty;
  },
};
