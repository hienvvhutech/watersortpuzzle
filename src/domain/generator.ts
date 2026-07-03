import { Level, Difficulty } from './types';
import { solve } from './solver';
import { TUBE_CAPACITY } from './rules';

// LCG Seedable Random Generator
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Returns pseudo-random float between 0 and 1
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  // Shuffles an array in place deterministically
  shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

// 12 Premium, harmonious pastel-like colors for the game
export const GAME_COLORS = [
  '#FF6B6B', // 0: Coral Red
  '#4D96FF', // 1: Soft Blue
  '#6BCB77', // 2: Soft Green
  '#FFD93D', // 3: Warm Yellow
  '#A06FFF', // 4: Lavender Purple
  '#FF9F45', // 5: Pastel Orange
  '#00D7C6', // 6: Mint Teal
  '#FF78F0', // 7: Rose Pink
  '#9B6B43', // 8: Cocoa Brown
  '#1E5128', // 9: Forest Green
  '#7A86B6', // 10: Slate Blue
  '#FF5D9E', // 11: Deep Pink
];

/**
 * Returns the difficulty category for a given level ID.
 */
export function getDifficultyForLevel(levelId: number): Difficulty {
  if (levelId <= 5) return 'easy';
  if (levelId <= 15) return 'normal';
  if (levelId <= 35) return 'hard';
  if (levelId <= 70) return 'expert';
  if (levelId <= 100) {
    return levelId % 10 === 0 ? 'impossible' : 'expert';
  }
  
  // Post level 100 - cycle difficulties with increasing weight
  const mod = levelId % 20;
  if (mod === 0) return 'impossible';
  if (mod <= 3) return 'easy';
  if (mod <= 8) return 'normal';
  if (mod <= 14) return 'hard';
  return 'expert';
}

/**
 * Returns the configurations (colors, empty tubes) based on difficulty.
 */
export function getDifficultyConfig(difficulty: Difficulty): { colorsCount: number; emptyTubes: number } {
  switch (difficulty) {
    case 'easy':
      return { colorsCount: 3, emptyTubes: 2 };
    case 'normal':
      return { colorsCount: 5, emptyTubes: 2 };
    case 'hard':
      return { colorsCount: 7, emptyTubes: 2 };
    case 'expert':
      return { colorsCount: 9, emptyTubes: 2 };
    case 'impossible':
      return { colorsCount: 11, emptyTubes: 2 };
  }
}

/**
 * Procedurally generates a solvable level deterministically based on Level ID.
 */
export function generateLevel(levelId: number): Level {
  const difficulty = getDifficultyForLevel(levelId);
  const { colorsCount, emptyTubes } = getDifficultyConfig(difficulty);
  
  let attempt = 0;
  let solvable = false;
  let tubes: string[][] = [];

  while (!solvable) {
    // Generate a deterministic seed combined of levelId and attempt number
    const rngSeed = levelId * 1000 + attempt;
    const rng = new SeededRandom(rngSeed);

    // Pick subset of colors
    const levelColors = GAME_COLORS.slice(0, colorsCount);

    // Build the color pool (each color appears 4 times)
    const colorPool: string[] = [];
    for (const color of levelColors) {
      for (let i = 0; i < TUBE_CAPACITY; i++) {
        colorPool.push(color);
      }
    }

    // Shuffle the pool
    const shuffledPool = rng.shuffle(colorPool);

    // Distribute into tubes
    tubes = [];
    for (let i = 0; i < colorsCount; i++) {
      const tubeColors = shuffledPool.slice(i * TUBE_CAPACITY, (i + 1) * TUBE_CAPACITY);
      tubes.push(tubeColors);
    }

    // Add empty tubes
    for (let i = 0; i < emptyTubes; i++) {
      tubes.push([]);
    }

    // Check solvability (limit solver iterations to 2000 for fast generation checks)
    const solution = solve(tubes, TUBE_CAPACITY, 2000);
    if (solution !== null && solution.length > 0) {
      solvable = true;
    } else {
      attempt++;
    }
  }

  return {
    id: levelId,
    tubes,
    difficulty,
  };
}
