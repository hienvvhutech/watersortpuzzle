import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GameState, GameStats, GameInventory, TubeSkin, GameTheme } from '../../domain/types';
import { generateLevel } from '../../domain/generator';
import { isValidMove, executeMove, checkWinCondition, TUBE_CAPACITY } from '../../domain/rules';
import { solve } from '../../domain/solver';
import { useProfileStore } from './profileStore';
import { SaveService } from '../../services/SaveService';

interface GameActions {
  startLevel: (levelId: number) => void;
  restartLevel: () => void;
  selectTube: (index: number | null) => void;
  tapTube: (index: number) => { poured: boolean; isWon: boolean; soundEffect: 'pour' | 'click' | 'error' | 'victory' };
  undo: () => boolean;
  addEmptyTube: () => boolean;
  useHint: () => { from: number; to: number } | null;
  addCoins: (amount: number) => void;
  claimDailyReward: (day: number, amount: number) => void;
  spinLuckyWheel: (rewardType: 'coins' | 'hint' | 'undo' | 'skin' | 'theme', rewardValue: any) => void;
  unlockSkin: (skin: TubeSkin, cost: number) => boolean;
  unlockTheme: (theme: GameTheme, cost: number) => boolean;
  equipSkin: (skin: TubeSkin) => void;
  equipTheme: (theme: GameTheme) => void;
  resetGame: () => void;
}

export type GameStore = GameState & GameActions & {
  selectedTubeIndex: number | null;
  parMoves: number;
  hasAddedTube: boolean;
};

// Initial states
const initialStats: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  moves: 0,
  time: 0,
  hintUsed: 0,
  undoUsed: 0,
  coinsEarned: 0,
  longestStreak: 0,
  currentStreak: 0,
};

const initialInventory: GameInventory = {
  unlockedSkins: ['glass'],
  unlockedThemes: ['light', 'dark'],
  currentSkin: 'glass',
  currentTheme: 'dark',
};

const defaultState: GameState = {
  currentLevel: 1,
  tubes: [],
  history: [],
  coins: 150, // Initial coins synced with profile
  stars: 0,
  initialTubes: [],
  stats: initialStats,
  inventory: initialInventory,
  dailyReward: {
    lastClaimedTimestamp: 0,
    consecutiveDays: 0,
  },
  luckySpin: {
    lastSpinTimestamp: 0,
    freeSpinsAvailable: 1,
  },
  levelStartTime: 0,
  isPlaying: false,
  isWon: false,
};


export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...defaultState,
      selectedTubeIndex: null,
      parMoves: 0,
      hasAddedTube: false,

      startLevel: (levelId) => {
        const level = generateLevel(levelId);
        const solution = solve(level.tubes, TUBE_CAPACITY, 2000);
        const par = solution ? solution.length : 12;

        set((state) => ({
          currentLevel: levelId,
          tubes: level.tubes.map((t) => [...t]),
          initialTubes: level.tubes.map((t) => [...t]),
          history: [],
          isPlaying: true,
          isWon: false,
          selectedTubeIndex: null,
          parMoves: par,
          hasAddedTube: false,
          levelStartTime: Date.now(),
          stats: {
            ...state.stats,
            gamesPlayed: state.stats.gamesPlayed + 1,
          },
        }));
      },

      restartLevel: () => {
        const { initialTubes } = get();
        if (initialTubes.length === 0) return;

        set((state) => ({
          tubes: initialTubes.map((t) => [...t]),
          history: [],
          selectedTubeIndex: null,
          isWon: false,
          isPlaying: true,
          levelStartTime: Date.now(),
        }));
      },

      selectTube: (index) => {
        set({ selectedTubeIndex: index });
      },

      tapTube: (index) => {
        const { selectedTubeIndex, tubes, isPlaying, isWon } = get();
        
        if (!isPlaying || isWon) {
          return { poured: false, isWon: false, soundEffect: 'click' };
        }

        // If no tube is currently selected
        if (selectedTubeIndex === null) {
          if (tubes[index].length > 0) {
            set({ selectedTubeIndex: index });
            return { poured: false, isWon: false, soundEffect: 'click' };
          }
          return { poured: false, isWon: false, soundEffect: 'click' };
        }

        // If clicking the same selected tube, deselect
        if (selectedTubeIndex === index) {
          set({ selectedTubeIndex: null });
          return { poured: false, isWon: false, soundEffect: 'click' };
        }

        // Attempt move
        if (isValidMove(tubes, selectedTubeIndex, index, TUBE_CAPACITY)) {
          const fromIdx = selectedTubeIndex;
          const toIdx = index;
          
          // Save pre-pour state for undo history
          const tubesSnapshot = tubes.map(t => [...t]);

          // Execute move
          const { tubes: nextTubes, move } = executeMove(tubes, fromIdx, toIdx, TUBE_CAPACITY);
          const win = checkWinCondition(nextTubes, TUBE_CAPACITY);

          let updatedStats = { ...get().stats };
          
          // Update stats
          updatedStats.moves += 1;

          if (win) {
            const timeSpent = Math.floor((Date.now() - get().levelStartTime) / 1000);
            updatedStats.wins += 1;
            updatedStats.time += timeSpent;
            updatedStats.currentStreak += 1;
            if (updatedStats.currentStreak > updatedStats.longestStreak) {
              updatedStats.longestStreak = updatedStats.currentStreak;
            }

            const movesTaken = get().history.length + 1; // current move counts
            
            // Trigger profile progression calculation
            useProfileStore.getState().handleLevelWin(
              get().currentLevel,
              movesTaken,
              timeSpent,
              get().parMoves,
              false, // isDailyChallenge
              get().stats.hintUsed > 0
            );
          }

          set((state) => ({
            tubes: nextTubes,
            selectedTubeIndex: null,
            history: [...state.history, { tubes: tubesSnapshot, move }],
            isWon: win,
            isPlaying: !win,
            stats: updatedStats,
          }));

          return {
            poured: true,
            isWon: win,
            soundEffect: win ? 'victory' : 'pour',
          };
        } else {
          // Move not valid, change selection to this tube if not empty, otherwise deselect
          if (tubes[index].length > 0) {
            set({ selectedTubeIndex: index });
            return { poured: false, isWon: false, soundEffect: 'click' };
          } else {
            set({ selectedTubeIndex: null });
            return { poured: false, isWon: false, soundEffect: 'error' };
          }
        }
      },

      undo: () => {
        const { history, isPlaying, isWon } = get();
        if (!isPlaying || isWon || history.length === 0) {
          return false;
        }

        const newHistory = [...history];
        const lastEntry = newHistory.pop()!;
        
        set((state) => ({
          tubes: lastEntry.tubes.map((t) => [...t]),
          history: newHistory,
          selectedTubeIndex: null,
          stats: {
            ...state.stats,
            undoUsed: state.stats.undoUsed + 1,
          },
        }));

        return true;
      },

      addEmptyTube: () => {
        const { tubes, hasAddedTube, isPlaying, isWon } = get();
        if (!isPlaying || isWon || hasAddedTube) {
          return false;
        }

        set((state) => ({
          tubes: [...state.tubes, []],
          hasAddedTube: true,
          selectedTubeIndex: null,
        }));
        
        return true;
      },

      useHint: () => {
        const { tubes, coins, isPlaying, isWon } = get();
        if (!isPlaying || isWon) return null;

        // Solver finds the next move
        const hint = solve(tubes, TUBE_CAPACITY, 2000);
        if (hint && hint.length > 0) {
          const nextMove = hint[0];
          
          set((state) => ({
            coins: Math.max(0, state.coins - 50), // Hint costs 50 coins
            stats: {
              ...state.stats,
              hintUsed: state.stats.hintUsed + 1,
            },
          }));

          return {
            from: nextMove.fromTubeIndex,
            to: nextMove.toTubeIndex,
          };
        }
        return null;
      },

      addCoins: (amount) => {
        set((state) => ({
          coins: state.coins + amount,
          stats: {
            ...state.stats,
            coinsEarned: state.stats.coinsEarned + amount,
          },
        }));
      },

      claimDailyReward: (day, amount) => {
        set((state) => ({
          coins: state.coins + amount,
          dailyReward: {
            lastClaimedTimestamp: Date.now(),
            consecutiveDays: day === 7 ? 1 : day,
          },
          stats: {
            ...state.stats,
            coinsEarned: state.stats.coinsEarned + amount,
          },
        }));
      },

      spinLuckyWheel: (rewardType, rewardValue) => {
        set((state) => {
          let updatedCoins = state.coins;
          const inventory = { ...state.inventory };

          if (rewardType === 'coins') {
            updatedCoins += rewardValue;
          } else if (rewardType === 'skin') {
            const skin = rewardValue as TubeSkin;
            if (!inventory.unlockedSkins.includes(skin)) {
              inventory.unlockedSkins = [...inventory.unlockedSkins, skin];
            }
          } else if (rewardType === 'theme') {
            const theme = rewardValue as GameTheme;
            if (!inventory.unlockedThemes.includes(theme)) {
              inventory.unlockedThemes = [...inventory.unlockedThemes, theme];
            }
          }

          return {
            coins: updatedCoins,
            inventory,
            luckySpin: {
              lastSpinTimestamp: Date.now(),
              freeSpinsAvailable: 0,
            },
          };
        });
      },

      unlockSkin: (skin, cost) => {
        const { coins, inventory } = get();
        if (coins < cost || inventory.unlockedSkins.includes(skin)) {
          return false;
        }

        set((state) => ({
          coins: state.coins - cost,
          inventory: {
            ...state.inventory,
            unlockedSkins: [...state.inventory.unlockedSkins, skin],
            currentSkin: skin,
          },
        }));
        return true;
      },

      unlockTheme: (theme, cost) => {
        const { coins, inventory } = get();
        if (coins < cost || inventory.unlockedThemes.includes(theme)) {
          return false;
        }

        set((state) => ({
          coins: state.coins - cost,
          inventory: {
            ...state.inventory,
            unlockedThemes: [...state.inventory.unlockedThemes, theme],
            currentTheme: theme,
          },
        }));
        return true;
      },

      equipSkin: (skin) => {
        const { inventory } = get();
        if (inventory.unlockedSkins.includes(skin)) {
          set((state) => ({
            inventory: {
              ...state.inventory,
              currentSkin: skin,
            },
          }));
        }
      },

      equipTheme: (theme) => {
        const { inventory } = get();
        if (inventory.unlockedThemes.includes(theme)) {
          set((state) => ({
            inventory: {
              ...state.inventory,
              currentTheme: theme,
            },
          }));
        }
      },

      resetGame: () => {
        set({
          ...defaultState,
          tubes: [],
          initialTubes: [],
        });
      },
    }),
    {
      name: 'wsp-game-state',
      storage: createJSONStorage(() => SaveService.createSecureStorage('gameStore')),
    }
  )
);

// Sync coin updates from profileStore into gameStore automatically to maintain backward-compatibility
useProfileStore.subscribe((profileState) => {
  useGameStore.setState({ coins: profileState.coins });
});

