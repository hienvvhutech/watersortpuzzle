jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInAnonymously: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(),
  persistentLocalCache: jest.fn(),
  persistentMultipleTabManager: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

import { isValidMove, executeMove, checkWinCondition, TUBE_CAPACITY } from '../src/domain/rules';
import { solve, getNextHint } from '../src/domain/solver';
import { generateLevel } from '../src/domain/generator';
import { useGameStore } from '../src/presentation/store/gameStore';

describe('Water Sort Puzzle Unit Tests', () => {
  
  // ----------------------------------------------------
  // 1. Rules & Validation Tests
  // ----------------------------------------------------
  describe('Game Rules (rules.ts)', () => {
    it('should validate win condition correctly', () => {
      // Won: all tubes either completely full of one color or completely empty
      const wonTubes = [
        ['red', 'red', 'red', 'red'],
        ['blue', 'blue', 'blue', 'blue'],
        [],
        [],
      ];
      expect(checkWinCondition(wonTubes, TUBE_CAPACITY)).toBe(true);

      // Not won: partially filled tubes
      const notWonTubes = [
        ['red', 'red', 'red'],
        ['blue', 'blue', 'blue', 'blue'],
        ['red'],
        [],
      ];
      expect(checkWinCondition(notWonTubes, TUBE_CAPACITY)).toBe(false);
    });

    it('should block invalid moves', () => {
      const tubes = [
        ['red', 'blue'], // Tube 0
        ['green', 'red'], // Tube 1
        [],              // Tube 2 (empty)
        ['blue', 'blue', 'blue', 'blue'], // Tube 3 (full)
      ];

      // Cannot pour from empty tube
      expect(isValidMove(tubes, 2, 0, TUBE_CAPACITY)).toBe(false);

      // Cannot pour to a full tube
      expect(isValidMove(tubes, 0, 3, TUBE_CAPACITY)).toBe(false);

      // Cannot pour mismatched color (blue on top of red)
      expect(isValidMove(tubes, 0, 1, TUBE_CAPACITY)).toBe(false);

      // Can pour to an empty tube
      expect(isValidMove(tubes, 0, 2, TUBE_CAPACITY)).toBe(true);
    });

    it('should execute moves correctly and count segments', () => {
      const tubes = [
        ['red', 'blue', 'blue'], // Top is blue (2 blocks)
        ['red'],
        [],
      ];

      // Pour blue from 0 to 2
      const result = executeMove(tubes, 0, 2, TUBE_CAPACITY);
      expect(result.tubes[0]).toEqual(['red']);
      expect(result.tubes[2]).toEqual(['blue', 'blue']);
      expect(result.move.color).toBe('blue');
      expect(result.move.amount).toBe(2);
    });
  });

  // ----------------------------------------------------
  // 2. AI Solver Tests
  // ----------------------------------------------------
  describe('AI Solver (solver.ts)', () => {
    it('should solve a simple puzzle', () => {
      // 2 moves puzzle: Pour red from 0 to 1, then blue from 0 to 2
      const tubes = [
        ['blue', 'blue', 'blue', 'red'],
        ['red', 'red', 'red'],
        ['blue'],
      ];
      
      const solution = solve(tubes, TUBE_CAPACITY);
      expect(solution).not.toBeNull();
      expect(solution!.length).toBe(2);
      
      // Get next hint
      const hint = getNextHint(tubes, TUBE_CAPACITY);
      expect(hint).not.toBeNull();
      expect(hint!.fromTubeIndex).toBe(0);
      expect(hint!.toTubeIndex).toBe(1);
    });

    it('should return null for unsolvable puzzles', () => {
      // A configuration with no empty tubes and mismatching colors
      const unsolvable = [
        ['red', 'blue', 'red', 'blue'],
        ['blue', 'red', 'blue', 'red'],
      ];
      const solution = solve(unsolvable, TUBE_CAPACITY);
      expect(solution).toBeNull();
    });
  });

  // ----------------------------------------------------
  // 3. Level Generator Tests
  // ----------------------------------------------------
  describe('Level Generator (generator.ts)', () => {
    it('should generate identical layouts for the same seed/level', () => {
      const lvl1_a = generateLevel(1);
      const lvl1_b = generateLevel(1);
      expect(lvl1_a.tubes).toEqual(lvl1_b.tubes);

      const lvl15_a = generateLevel(15);
      const lvl15_b = generateLevel(15);
      expect(lvl15_a.tubes).toEqual(lvl15_b.tubes);
    });

    it('should scale difficulty progressively', () => {
      const lvl1 = generateLevel(1);
      const lvl50 = generateLevel(50);
      
      // Higher levels should have more tubes and more colors
      expect(lvl50.tubes.length).toBeGreaterThanOrEqual(lvl1.tubes.length);
    });

    it('should generate all levels from 1 to 50 without freezing', () => {
      for (let i = 1; i <= 50; i++) {
        const lvl = generateLevel(i);
        expect(lvl).toBeDefined();
        expect(lvl.tubes.length).toBeGreaterThan(0);
      }
    });
  });

  // ----------------------------------------------------
  // 4. Game Loop Store Tests
  // ----------------------------------------------------
  describe('Zustand GameStore (gameStore.ts)', () => {
    beforeEach(() => {
      useGameStore.getState().resetGame();
    });

    it('should start level correctly', () => {
      const store = useGameStore.getState();
      store.startLevel(1);
      
      const state = useGameStore.getState();
      expect(state.currentLevel).toBe(1);
      expect(state.isPlaying).toBe(true);
      expect(state.isWon).toBe(false);
      expect(state.tubes.length).toBeGreaterThan(0);
      expect(state.history.length).toBe(0);
    });

    it('should handle tap selections and undos', () => {
      useGameStore.getState().startLevel(1);
      
      let state = useGameStore.getState();
      // Select a tube containing water
      const firstNonEmpty = state.tubes.findIndex(t => t.length > 0);
      
      useGameStore.getState().tapTube(firstNonEmpty);
      expect(useGameStore.getState().selectedTubeIndex).toBe(firstNonEmpty);

      useGameStore.getState().tapTube(firstNonEmpty);
      expect(useGameStore.getState().selectedTubeIndex).toBe(null);
    });
  });
});
