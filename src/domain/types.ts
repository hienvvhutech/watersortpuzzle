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

export interface WinRewardResult {
  crown: CrownType;
  baseScore: number;
  timeBonus: number;
  perfectBonus: number;
  noHintBonus: number;
  comboMultiplier: number;
  totalScore: number;

  baseCoins: number;
  crownBonusCoins: number;
  streakBonusCoins: number;
  totalCoins: number;

  baseXp: number;
  crownBonusXp: number;
  streakBonusXp: number;
  totalXp: number;

  starsEarned: number;
  newPerfectStreakCombo: number;
}

export interface GameState {
  currentLevel: number;
  difficulty: Difficulty;
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
  lastWinReward: WinRewardResult | null;
  carryoverTimeBonus: number; // Carryover time in seconds from previous level
}

export type CrownType = 'none' | 'bronze' | 'silver' | 'gold';

export interface LevelProgress {
  levelId: number;
  highestCrown: CrownType;
  bestMoves: number;
  bestScore: number;
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
  perfectStreakCombo: number;
  consecutiveFails: number;
  seasonPassStars: number;
  levelProgress: Record<number, LevelProgress>;
  dailyChallengeCompletions: string[]; // YYYYMMDD dates
  mysteryChest: MysteryChestState;
  league: LeagueProgress;
  achievements: Record<string, Achievement>;
  dailyMissions: DailyMission[];
  unlockedBadges: string[];

  // Player Identity Phase 5
  playerId: string | null;
  displayName: string;
  avatarId: string;
  country?: string;
  createdAt: number;
  updatedAt: number;
  isProfileCreated: boolean;
  
  // Play Session Telemetry
  sessionLevelsPlayed: number;
  sessionTotalTime: number; // in seconds
  sessionCoinsEarned: number;
  sessionXpEarned: number;
  sessionStarsEarned: number;
  sessionPerfectWins: number;
  sessionGoldCrowns: number;
  sessionNewRecords: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarId?: string;
  country?: string;
  level: number;
  score: number;
  coins: number;
  bestTime: number; // in seconds
  rank?: number;
  movement?: 'up' | 'down' | 'same';
}

export interface LeaderboardGroup {
  id: string;
  name: string;
  friends: string[];
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
  inviteCode?: string;
  ownerUid?: string;
  memberCount?: number;
  createdAt?: string;
}

export interface BattleSession {
  roomId: string;
  opponentName: string;
  opponentProgress: number; // 0 to 100
  isHost: boolean;
  status: 'waiting' | 'active' | 'won' | 'lost';
}

export interface PlayerProfile {
  playerId: string;
  displayName: string;
  avatarId: string;
  country?: string;
  currentLevel: number;
  highestLevel: number;
  totalCoins: number;
  totalScore: number;
  bestTime: number;
  createdAt: number;
  updatedAt: number;
  isProfileCreated: boolean;
}

