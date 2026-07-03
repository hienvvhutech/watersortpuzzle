import { GameBalance } from '../config/GameBalance';
import { CrownType } from '../domain/types';

export interface WinRewardResult {
  crown: CrownType;
  baseCoins: number;
  crownBonusCoins: number;
  streakBonusCoins: number;
  totalCoins: number;

  baseXp: number;
  crownBonusXp: number;
  streakBonusXp: number;
  dailyChallengeBonusXp: number;
  totalXp: number;
}

export const RewardService = {
  /**
   * Calculates the rewards awarded upon winning a level.
   */
  calculateWinRewards: (
    movesTaken: number,
    optimalMoves: number,
    winStreak: number,
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

    // 2. Coin Reward Calculations
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

    // 3. XP Reward Calculations
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

    // Compute totals
    const totalCoins = baseCoins + crownBonusCoins + streakBonusCoins + dailyChallengeBonusCoins;
    let totalXp = baseXp + crownBonusXp + streakBonusXp + dailyChallengeBonusXp;

    // If hints were used, apply 50% XP penalty
    if (hintsUsed) {
      totalXp = Math.max(10, Math.floor(totalXp * 0.5));
    }

    return {
      crown,
      baseCoins,
      crownBonusCoins,
      streakBonusCoins,
      totalCoins,
      baseXp,
      crownBonusXp,
      streakBonusXp,
      dailyChallengeBonusXp,
      totalXp,
    };
  },
};
