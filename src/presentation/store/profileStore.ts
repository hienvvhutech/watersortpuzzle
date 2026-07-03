import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProfileState, LevelProgress, CrownType, Achievement, DailyMission } from '../../domain/types';
import { SaveService } from '../../services/SaveService';
import { EconomyService } from '../../services/EconomyService';
import { XPService } from '../../services/XPService';
import { RewardService } from '../../services/RewardService';

// Default initial state
const defaultState = {
  playerLevel: 1,
  playerXp: 0,
  coins: 150, // Starter coins
  diamonds: 0,
  winStreak: 0,
  longestStreak: 0,
  levelProgress: {} as Record<number, LevelProgress>,
  dailyChallengeCompletions: [] as string[],
  mysteryChest: { chestMeter: 0, keysCount: 0 },
  league: {
    leaguePoints: 0,
    currentLeague: 'bronze' as const,
    leagueRank: 10,
    weeklyEndTime: Date.now() + 86400000 * 7,
  },
  achievements: {} as Record<string, Achievement>,
  dailyMissions: [] as DailyMission[],
  unlockedBadges: [] as string[],
};

// Seed initial achievements
const INITIAL_ACHIEVEMENTS: Record<string, Omit<Achievement, 'current' | 'completed' | 'rewardClaimed'>> = {
  first_victory: {
    id: 'first_victory',
    title: 'First Victory',
    description: 'Win your first level',
    target: 1,
    rewardType: 'coins',
    rewardValue: '50',
  },
  perfect_solver: {
    id: 'perfect_solver',
    title: 'Perfect Solver',
    description: 'Win 10 levels without hints',
    target: 10,
    rewardType: 'coins',
    rewardValue: '200',
  },
  ai_conqueror: {
    id: 'ai_conqueror',
    title: 'AI Conqueror',
    description: 'Match or beat the AI optimal moves 15 times',
    target: 15,
    rewardType: 'skin',
    rewardValue: 'golden',
  },
  crown_collector: {
    id: 'crown_collector',
    title: 'Crown Collector',
    description: 'Earn 30 Gold Crowns',
    target: 30,
    rewardType: 'theme',
    rewardValue: 'galaxy',
  },
  speed_runner: {
    id: 'speed_runner',
    title: 'Speed Demon',
    description: 'Complete any level in under 35 seconds',
    target: 1,
    rewardType: 'coins',
    rewardValue: '100',
  },
};

export interface ProfileStore extends ProfileState {
  // Coin Transactions
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  refundCoins: (amount: number) => void;

  // XP & Streaks
  addXp: (amount: number) => { leveledUp: boolean; levelsGained: number };
  incrementStreak: () => void;
  resetStreak: () => void;

  // Level Completions
  handleLevelWin: (
    levelId: number,
    movesTaken: number,
    timeTaken: number,
    optimalMoves: number,
    isDailyChallenge: boolean,
    hintsUsed: boolean
  ) => {
    crown: CrownType;
    coinsEarned: number;
    xpEarned: number;
    leveledUp: boolean;
    levelsGained: number;
    isNewBestMoves: boolean;
    isNewBestTime: boolean;
    isNewCrown: boolean;
  };

  // Achievements
  incrementAchievementProgress: (id: string, amount: number) => void;
  claimAchievementReward: (id: string) => void;

  // Badges & Skins
  unlockBadge: (badgeId: string) => void;
  resetProfile: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      ...defaultState,

      // Initialize achievements if empty
      achievements: {},

      addCoins: (amount) => {
        set((state) => ({ coins: EconomyService.add(state.coins, amount) }));
      },

      spendCoins: (amount) => {
        const currentCoins = get().coins;
        if (!EconomyService.canAfford(currentCoins, amount)) {
          return false;
        }
        set((state) => ({ coins: EconomyService.spend(state.coins, amount) }));
        return true;
      },

      refundCoins: (amount) => {
        set((state) => ({ coins: EconomyService.refund(state.coins, amount) }));
      },

      addXp: (amount) => {
        const { playerLevel, playerXp } = get();
        const result = XPService.addXp(playerLevel, playerXp, amount);
        set({
          playerLevel: result.level,
          playerXp: result.xp,
        });
        return {
          leveledUp: result.leveledUp,
          levelsGained: result.levelsGained,
        };
      },

      incrementStreak: () => {
        set((state) => {
          const nextStreak = state.winStreak + 1;
          const nextLongest = Math.max(state.longestStreak, nextStreak);
          return {
            winStreak: nextStreak,
            longestStreak: nextLongest,
          };
        });
      },

      resetStreak: () => {
        set({ winStreak: 0 });
      },

      handleLevelWin: (levelId, movesTaken, timeTaken, optimalMoves, isDailyChallenge, hintsUsed) => {
        const { winStreak, levelProgress, coins, playerLevel, playerXp } = get();

        // 1. Calculate Rewards using RewardService
        const rewards = RewardService.calculateWinRewards(
          movesTaken,
          optimalMoves,
          winStreak,
          isDailyChallenge,
          hintsUsed
        );

        // 2. XP & Level calculations
        const xpResult = XPService.addXp(playerLevel, playerXp, rewards.totalXp);

        // 3. Update Level Progress
        const existingProgress = levelProgress[levelId];
        let isNewBestMoves = false;
        let isNewBestTime = false;
        let isNewCrown = false;

        const nextCrown = rewards.crown;
        let highestCrown = nextCrown;
        let bestMoves = movesTaken;
        let fastestTime = timeTaken;

        if (existingProgress) {
          // Compare moves
          if (movesTaken < existingProgress.bestMoves) {
            bestMoves = movesTaken;
            isNewBestMoves = true;
          } else {
            bestMoves = existingProgress.bestMoves;
          }

          // Compare times
          if (timeTaken < existingProgress.fastestTime) {
            fastestTime = timeTaken;
            isNewBestTime = true;
          } else {
            fastestTime = existingProgress.fastestTime;
          }

          // Compare crowns: gold > silver > bronze
          const crownRank = { none: 0, bronze: 1, silver: 2, gold: 3 };
          if (crownRank[nextCrown] > crownRank[existingProgress.highestCrown]) {
            highestCrown = nextCrown;
            isNewCrown = true;
          } else {
            highestCrown = existingProgress.highestCrown;
          }
        } else {
          isNewBestMoves = true;
          isNewBestTime = true;
          isNewCrown = true;
        }

        const updatedProgress: LevelProgress = {
          levelId,
          highestCrown,
          bestMoves,
          fastestTime,
          firstTry: existingProgress ? existingProgress.firstTry : !hintsUsed,
          restarts: existingProgress ? existingProgress.restarts : 0,
          hintsUsedCount: existingProgress
            ? existingProgress.hintsUsedCount + (hintsUsed ? 1 : 0)
            : (hintsUsed ? 1 : 0),
        };

        const nextLevelProgress = {
          ...levelProgress,
          [levelId]: updatedProgress,
        };

        // 4. Update Win Streak
        const nextStreak = winStreak + 1;
        const nextLongest = Math.max(get().longestStreak, nextStreak);

        // 5. Update State
        set({
          coins: EconomyService.add(coins, rewards.totalCoins),
          playerLevel: xpResult.level,
          playerXp: xpResult.xp,
          winStreak: nextStreak,
          longestStreak: nextLongest,
          levelProgress: nextLevelProgress,
        });

        // 6. Update achievements dynamically
        get().incrementAchievementProgress('first_victory', 1);
        if (!hintsUsed) {
          get().incrementAchievementProgress('perfect_solver', 1);
        }
        if (rewards.crown === 'gold') {
          get().incrementAchievementProgress('crown_collector', 1);
        }
        if (movesTaken <= optimalMoves) {
          get().incrementAchievementProgress('ai_conqueror', 1);
        }
        if (timeTaken < 35) {
          get().incrementAchievementProgress('speed_runner', 1);
        }

        return {
          crown: rewards.crown,
          coinsEarned: rewards.totalCoins,
          xpEarned: rewards.totalXp,
          leveledUp: xpResult.leveledUp,
          levelsGained: xpResult.levelsGained,
          isNewBestMoves,
          isNewBestTime,
          isNewCrown,
        };
      },

      incrementAchievementProgress: (id, amount) => {
        const { achievements } = get();
        const currentAchievements = { ...achievements };

        // Lazy initialize achievement if not present in saved state
        if (!currentAchievements[id]) {
          const config = INITIAL_ACHIEVEMENTS[id];
          if (!config) return;
          currentAchievements[id] = {
            ...config,
            current: 0,
            completed: false,
            rewardClaimed: false,
          };
        }

        const ach = currentAchievements[id];
        if (ach.completed) return;

        const nextCurrent = ach.current + amount;
        const completed = nextCurrent >= ach.target;

        currentAchievements[id] = {
          ...ach,
          current: Math.min(nextCurrent, ach.target),
          completed,
        };

        set({ achievements: currentAchievements });
      },

      claimAchievementReward: (id) => {
        const { achievements, coins } = get();
        const ach = achievements[id];
        if (!ach || !ach.completed || ach.rewardClaimed) return;

        const updatedAchievements = {
          ...achievements,
          [id]: {
            ...ach,
            rewardClaimed: true,
          },
        };

        set({ achievements: updatedAchievements });

        if (ach.rewardType === 'coins') {
          const val = parseInt(ach.rewardValue, 10) || 0;
          set({ coins: EconomyService.add(coins, val) });
        }
      },

      unlockBadge: (badgeId) => {
        set((state) => {
          if (state.unlockedBadges.includes(badgeId)) return {};
          return { unlockedBadges: [...state.unlockedBadges, badgeId] };
        });
      },

      resetProfile: () => {
        set(defaultState);
      },
    }),
    {
      name: 'water-sort-profile-storage',
      storage: createJSONStorage(() => SaveService.createSecureStorage('profileStore')),
    }
  )
);
