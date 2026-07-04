import AsyncStorage from '@react-native-async-storage/async-storage';
import { LeaderboardEntry, LeaderboardGroup } from '../domain/types';
import { ILeaderboardRepository } from '../domain/repositories/ILeaderboardRepository';

const STORAGE_KEYS = {
  PLAYERS: 'wsp_leaderboard_players',
  GROUPS: 'wsp_leaderboard_groups',
  FRIEND_STATS: 'wsp_leaderboard_friend_stats',
};

// Realistic mock player generator names
const SEED_USERNAMES = [
  'SpeedSortPro', 'WaterMaster', 'LiquidLogic', 'FlowFighter',
  'AquaSolver', 'TubeTornado', 'GravityGrad', 'ColorConqueror',
  'NexusSort', 'ZenPour', 'BottleBoss', 'HydroHero', 'RainbowRacer'
];

export class LocalLeaderboardRepository implements ILeaderboardRepository {
  /**
   * Initializes persistent mock global players if not already generated.
   */
  private async ensureInitialized(): Promise<void> {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PLAYERS);
    if (!stored) {
      const generatedPlayers: LeaderboardEntry[] = SEED_USERNAMES.map((username, index) => {
        const rankIndex = index + 1;
        const avatarIndex = Math.floor(1 + Math.random() * 20);
        const countries = ['VN', 'US', 'SG', 'JP', 'KR', 'TH', 'PH', 'MY'];
        const randomCountry = countries[Math.floor(Math.random() * countries.length)];
        return {
          userId: `sim_${rankIndex}`,
          username,
          avatarId: `avatar_${avatarIndex}`,
          country: randomCountry,
          level: Math.max(5, 40 - index * 3), // Levels range from 40 down to 5
          score: Math.max(1000, 15000 - index * 1100),
          coins: Math.max(500, 9500 - index * 700),
          bestTime: 12 + index * 6, // Times range from 12s up to 80s
        };
      });
      await AsyncStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(generatedPlayers));
    }
  }

  async getGlobalLeaderboard(
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number
  ): Promise<LeaderboardEntry[]> {
    await this.ensureInitialized();
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PLAYERS);
    let players: LeaderboardEntry[] = stored ? JSON.parse(stored) : [];

    // Fetch player's current scores from AsyncStorage if saved
    const playerSelf = await this.getPlayerSelf();
    if (playerSelf) {
      // Remove previous duplicate self entries
      players = players.filter(p => p.userId !== 'player_self');
      players.push(playerSelf);
    }

    // Sort players based on category
    players.sort((a, b) => {
      if (sortBy === 'bestTime') {
        return a.bestTime - b.bestTime; // Lower time is better
      }
      return b[sortBy] - a[sortBy]; // Higher is better for level, score, coins
    });

    // Assign rank values
    const rankedPlayers = players.map((p, idx) => ({ ...p, rank: idx + 1 }));
    return rankedPlayers.slice(0, limit);
  }

  async getFriendsLeaderboard(
    groupId: string,
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number
  ): Promise<LeaderboardEntry[]> {
    const groupsStored = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    const groups: LeaderboardGroup[] = groupsStored ? JSON.parse(groupsStored) : [];
    const targetGroup = groups.find(g => g.id === groupId);

    if (!targetGroup) return [];

    const statsStored = await AsyncStorage.getItem(STORAGE_KEYS.FRIEND_STATS);
    const friendStats: Record<string, Omit<LeaderboardEntry, 'rank'>> = statsStored ? JSON.parse(statsStored) : {};

    let list: LeaderboardEntry[] = [];

    // Add friends in group
    targetGroup.friends.forEach((friendName) => {
      const stats = friendStats[`${groupId}_${friendName}`];
      if (stats) {
        list.push({ ...stats });
      }
    });

    // Add self to the group leaderboard
    const playerSelf = await this.getPlayerSelf();
    if (playerSelf) {
      list.push(playerSelf);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'bestTime') {
        return a.bestTime - b.bestTime;
      }
      return b[sortBy] - a[sortBy];
    });

    // Rank
    const rankedList = list.map((p, idx) => ({ ...p, rank: idx + 1 }));
    return rankedList.slice(0, limit);
  }

  async saveScore(entry: Omit<LeaderboardEntry, 'rank'>): Promise<void> {
    await AsyncStorage.setItem('wsp_player_self_score', JSON.stringify(entry));
  }

  async createGroup(name: string, friends: string[]): Promise<LeaderboardGroup> {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    const groups: LeaderboardGroup[] = stored ? JSON.parse(stored) : [];

    const newGroup: LeaderboardGroup = {
      id: `group_${Date.now()}`,
      name,
      friends,
    };

    groups.push(newGroup);
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));

    // Generate persistent scores for each friend in this group
    const statsStored = await AsyncStorage.getItem(STORAGE_KEYS.FRIEND_STATS);
    const friendStats: Record<string, Omit<LeaderboardEntry, 'rank'>> = statsStored ? JSON.parse(statsStored) : {};

    friends.forEach((friendName) => {
      const randomSeed = Math.random();
      const avatarIndex = Math.floor(1 + Math.random() * 20);
      const countries = ['VN', 'US', 'SG', 'JP', 'KR', 'TH', 'PH', 'MY'];
      const randomCountry = countries[Math.floor(Math.random() * countries.length)];
      friendStats[`${newGroup.id}_${friendName}`] = {
        userId: `friend_${newGroup.id}_${friendName}`,
        username: friendName,
        avatarId: `avatar_${avatarIndex}`,
        country: randomCountry,
        level: Math.max(1, Math.floor(randomSeed * 25)),
        score: Math.max(200, Math.floor(randomSeed * 8500)),
        coins: Math.max(50, Math.floor(randomSeed * 4500)),
        bestTime: Math.max(15, Math.floor(15 + randomSeed * 60)),
      };
    });

    await AsyncStorage.setItem(STORAGE_KEYS.FRIEND_STATS, JSON.stringify(friendStats));
    return newGroup;
  }

  async getGroups(): Promise<LeaderboardGroup[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Helper to retrieve player's own scores
   */
  private async getPlayerSelf(): Promise<LeaderboardEntry | null> {
    const stored = await AsyncStorage.getItem('wsp_player_self_score');
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  }
}
