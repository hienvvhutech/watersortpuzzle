export const GameBalance = {
  // XP System Constants
  XP_PER_LEVEL_BASE: 150,
  XP_PER_LEVEL_MULTIPLIER: 1.2, // Level up cost scales: base * (level ^ multiplier)

  // Level Win Coin Payouts
  BASE_COIN_REWARD: 50,
  GOLD_CROWN_BONUS_COINS: 30,
  SILVER_CROWN_BONUS_COINS: 15,
  BRONZE_CROWN_BONUS_COINS: 5,

  // Level Win XP Payouts
  BASE_XP_REWARD: 50,
  GOLD_CROWN_BONUS_XP: 40,
  SILVER_CROWN_BONUS_XP: 20,
  BRONZE_CROWN_BONUS_XP: 10,

  // Win Streak Multipliers
  STREAK_BONUS_XP_PER_WIN: 5, // streak * 5 XP added
  STREAK_BONUS_COINS_PER_WIN: 3, // streak * 3 Coins added
  STREAK_MAX_BONUS_XP: 50, // Capped maximum streak bonus
  STREAK_MAX_BONUS_COINS: 30,

  // Daily Challenge Payouts
  DAILY_CHALLENGE_COIN_BONUS: 100,
  DAILY_CHALLENGE_XP_BONUS: 100,

  // Chest Constants
  CHEST_METER_WIN_INCREMENT: 20, // 5 wins to fill a chest

  // Cooldowns
  LUCKY_WHEEL_COOLDOWN_MS: 86400000, // 24 hours

  // Gameplay Action Costs
  HINT_COST_COINS: 50,
  ADD_TUBE_COST_COINS: 100,

  // Difficulty boundaries based on excess moves from optimal solver (parMoves)
  getDifficulty: (excessMoves: number): 'easy' | 'medium' | 'hard' | 'expert' | 'master' => {
    if (excessMoves <= 0) return 'easy';
    if (excessMoves <= 2) return 'medium';
    if (excessMoves <= 5) return 'hard';
    if (excessMoves <= 8) return 'expert';
    return 'master';
  },
};
