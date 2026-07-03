export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'impossible';

export interface Level {
  id: number;
  tubes: string[][];
  difficulty: Difficulty;
  isCustom?: boolean;
}

export interface Move {
  fromTubeIndex: number;
  toTubeIndex: number;
  color: string;
  amount: number;
}

export interface HistoryEntry {
  tubes: string[][];
  move: Move;
}

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  moves: number;
  time: number; // In seconds
  hintUsed: number;
  undoUsed: number;
  coinsEarned: number;
  longestStreak: number;
  currentStreak: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  language: 'en' | 'vi' | 'ja' | 'ko' | 'zh' | 'es' | 'fr' | 'de';
  notificationsEnabled: boolean;
}

export type TubeSkin =
  | 'glass'
  | 'crystal'
  | 'wood'
  | 'neon'
  | 'golden'
  | 'halloween'
  | 'christmas'
  | 'ocean'
  | 'galaxy'
  | 'cyberpunk';

export type GameTheme =
  | 'light'
  | 'dark'
  | 'forest'
  | 'candy'
  | 'space'
  | 'ocean'
  | 'night'
  | 'lava'
  | 'desert';

export interface GameInventory {
  unlockedSkins: TubeSkin[];
  unlockedThemes: GameTheme[];
  currentSkin: TubeSkin;
  currentTheme: GameTheme;
}

export interface DailyRewardState {
  lastClaimedTimestamp: number; // Unix timestamp
  consecutiveDays: number; // 0 to 7
}

export interface LuckySpinState {
  lastSpinTimestamp: number; // Unix timestamp
  freeSpinsAvailable: number;
}

export interface GameState {
  currentLevel: number;
  tubes: string[][]; // Each inner array represents color layers in the tube from bottom to top
  history: HistoryEntry[];
  coins: number;
  stars: number;
  initialTubes: string[][]; // For restarting the level
  stats: GameStats;
  inventory: GameInventory;
  dailyReward: DailyRewardState;
  luckySpin: LuckySpinState;
  levelStartTime: number; // Date.now() timestamp
  isPlaying: boolean;
  isWon: boolean;
}

export type CrownType = 'none' | 'bronze' | 'silver' | 'gold';

export interface LevelProgress {
  levelId: number;
  highestCrown: CrownType;
  bestMoves: number;
  fastestTime: number; // in seconds
  firstTry: boolean;
  restarts: number;
  hintsUsedCount: number;
}

export interface DailyMission {
  id: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
  rewardClaimed: boolean;
  rewardType: 'coins' | 'xp' | 'key';
  rewardValue: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
  rewardClaimed: boolean;
  rewardType: 'coins' | 'xp' | 'skin' | 'theme';
  rewardValue: string; // e.g. "100" or skin name
}

export interface MysteryChestState {
  chestMeter: number; // 0 to 100
  keysCount: number;
}

export interface LeagueProgress {
  leaguePoints: number;
  currentLeague: 'bronze' | 'silver' | 'gold' | 'diamond' | 'master' | 'legend';
  leagueRank: number;
  weeklyEndTime: number; // timestamp
}

export interface ProfileState {
  playerLevel: number;
  playerXp: number;
  coins: number;
  diamonds: number;
  winStreak: number;
  longestStreak: number;
  levelProgress: Record<number, LevelProgress>;
  dailyChallengeCompletions: string[]; // YYYYMMDD dates
  mysteryChest: MysteryChestState;
  league: LeagueProgress;
  achievements: Record<string, Achievement>;
  dailyMissions: DailyMission[];
  unlockedBadges: string[];
}

