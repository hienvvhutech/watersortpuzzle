import { GameBalance } from '../config/GameBalance';
import { CrownType, Difficulty, WinRewardResult } from '../domain/types';
import { DifficultyService } from './DifficultyService';

export const RewardService = {
  /**
   * Calculates detailed score-based and coin-based rewards upon winning a level.
   */
  calculateWinRewards: (
    movesTaken: number,
    optimalMoves: number,
    timeTaken: number,
    difficulty: Difficulty,
    winStreak: number,
    perfectStreakCombo: number,
    isDailyChallenge: boolean,
    hintsUsed: boolean
  ): WinRewardResult => {
    // 1. Calculate Crown
    let crown: CrownType = 'bronze';
    if (movesTaken <= optimalMoves) {
      crown = 'gold';
    } else if (movesTaken <= optimalMoves + 3) {
      crown = 'silver';
    }

    // If hints were used, cap crown at silver
    if (hintsUsed && crown === 'gold') {
      crown = 'silver';
    }

    // 2. Perfect Win Combo Multiplier
    let newPerfectStreakCombo = perfectStreakCombo;
    if (crown === 'gold') {
      newPerfectStreakCombo = perfectStreakCombo + 1;
    } else {
      newPerfectStreakCombo = 0; // Reset combo if not a perfect win
    }
    // Combo multiplier adds +10% per consecutive perfect win, capped at x2.0 (+100% bonus)
    const comboMultiplier = 1.0 + Math.min(10, newPerfectStreakCombo) * 0.1;

    // 3. Score Calculations
    let baseScore = 200;
    switch (difficulty) {
      case 'easy':
        baseScore = 200;
        break;
      case 'normal':
        baseScore = 400;
        break;
      case 'hard':
        baseScore = 800;
        break;
      case 'expert':
        baseScore = 1500;
        break;
      case 'impossible':
        baseScore = 2500;
        break;
    }

    // Time Bonus: target time based on difficulty
    const targetTime = DifficultyService.getTargetTimeForDifficulty(difficulty);
    const timeBonus = timeTaken < targetTime ? Math.floor((targetTime - timeTaken) * 5) : 0;

    // Perfect Bonus (correct moves matching AI solver)
    const perfectBonus = crown === 'gold' ? 300 : 0;

    // No Hint Bonus
    const noHintBonus = !hintsUsed ? 200 : 0;

    // Calculate Total Score
    const totalScore = Math.floor(baseScore * comboMultiplier) + timeBonus + noHintBonus + perfectBonus;

    // 4. Season Pass Stars
    let starsEarned = 1; // Bronze
    if (crown === 'gold') {
      starsEarned = 3;
    } else if (crown === 'silver') {
      starsEarned = 2;
    }

    // 5. Coin Reward Calculations (decoupled from score)
    const baseCoins = GameBalance.BASE_COIN_REWARD;
    let crownBonusCoins = GameBalance.BRONZE_CROWN_BONUS_COINS;
    if (crown === 'gold') {
      crownBonusCoins = GameBalance.GOLD_CROWN_BONUS_COINS;
    } else if (crown === 'silver') {
      crownBonusCoins = GameBalance.SILVER_CROWN_BONUS_COINS;
    }

    const rawStreakCoins = winStreak * GameBalance.STREAK_BONUS_COINS_PER_WIN;
    const streakBonusCoins = Math.min(rawStreakCoins, GameBalance.STREAK_MAX_BONUS_COINS);
    const dailyChallengeBonusCoins = isDailyChallenge ? GameBalance.DAILY_CHALLENGE_COIN_BONUS : 0;
    const totalCoins = baseCoins + crownBonusCoins + streakBonusCoins + dailyChallengeBonusCoins;

    // 6. XP Reward Calculations
    const baseXp = GameBalance.BASE_XP_REWARD;
    let crownBonusXp = GameBalance.BRONZE_CROWN_BONUS_XP;
    if (crown === 'gold') {
      crownBonusXp = GameBalance.GOLD_CROWN_BONUS_XP;
    } else if (crown === 'silver') {
      crownBonusXp = GameBalance.SILVER_CROWN_BONUS_XP;
    }

    const rawStreakXp = winStreak * GameBalance.STREAK_BONUS_XP_PER_WIN;
    const streakBonusXp = Math.min(rawStreakXp, GameBalance.STREAK_MAX_BONUS_XP);
    const dailyChallengeBonusXp = isDailyChallenge ? GameBalance.DAILY_CHALLENGE_XP_BONUS : 0;

    let totalXp = baseXp + crownBonusXp + streakBonusXp + dailyChallengeBonusXp;

    // 50% XP penalty if Hint used
    if (hintsUsed) {
      totalXp = Math.max(10, Math.floor(totalXp * 0.5));
    }

    return {
      crown,
      baseScore,
      timeBonus,
      perfectBonus,
      noHintBonus,
      comboMultiplier,
      totalScore,

      baseCoins,
      crownBonusCoins,
      streakBonusCoins,
      totalCoins,

      baseXp,
      crownBonusXp,
      streakBonusXp,
      totalXp,

      starsEarned,
      newPerfectStreakCombo,
    };
  },
};
