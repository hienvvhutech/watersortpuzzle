import { services } from '../shared/IServiceRegistry';
import { ILeaderboardRepository } from '../domain/repositories/ILeaderboardRepository';
import { LeaderboardEntry, LeaderboardGroup } from '../domain/types';
import { ScoreValidationService } from './ScoreValidationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_EXPIRY = 60000; // 60 seconds cache lifetime

/**
 * Service managing Leaderboard operations.
 * Resolves repository dependency via the DI ServiceRegistry.
 */
export const LeaderboardService = {
  /**
   * Fetches global rankings sorted by a specific category.
   * Caches page 1 locally in AsyncStorage and calculates rank movements.
   */
  getGlobal: async (
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number = 20,
    lastVisibleDoc?: any
  ): Promise<{ entries: LeaderboardEntry[]; lastDoc?: any }> => {
    const cacheKey = `wsp_leaderboard_cache_${sortBy}`;
    const repo = services.get<ILeaderboardRepository>('Leaderboard');

    // 1. If paginating (fetching next pages), query Firestore directly
    if (lastVisibleDoc) {
      return repo.getGlobalLeaderboard(sortBy, limit, lastVisibleDoc);
    }

    // 2. Load from local cache for instant rendering
    let cachedEntries: LeaderboardEntry[] = [];
    let cacheTimestamp = 0;
    try {
      const cachedStr = await AsyncStorage.getItem(cacheKey);
      if (cachedStr) {
        const payload = JSON.parse(cachedStr);
        cachedEntries = payload.entries || [];
        cacheTimestamp = payload.timestamp || 0;
      }
    } catch (e) {}

    const isStale = Date.now() - cacheTimestamp > CACHE_EXPIRY;

    // If cache is fresh, return immediately
    if (cachedEntries.length > 0 && !isStale) {
      return { entries: cachedEntries, lastDoc: undefined };
    }

    // 3. Fetch from remote repository
    try {
      const res = await repo.getGlobalLeaderboard(sortBy, limit, lastVisibleDoc);
      
      // Map previous ranks to detect movement
      const prevRanksMap = new Map<string, number>();
      cachedEntries.forEach((entry, idx) => {
        prevRanksMap.set(entry.userId, idx + 1);
      });

      const updatedEntries = res.entries.map((entry, idx) => {
        const currentRank = idx + 1;
        const prevRank = prevRanksMap.get(entry.userId);
        let movement: 'up' | 'down' | 'same' = 'same';
        if (prevRank !== undefined) {
          if (prevRank > currentRank) movement = 'up';
          else if (prevRank < currentRank) movement = 'down';
        }
        return { ...entry, rank: currentRank, movement };
      });

      // Save to cache asynchronously
      AsyncStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        entries: updatedEntries,
      })).catch(() => {});

      return { entries: updatedEntries, lastDoc: res.lastDoc };
    } catch (e) {
      console.warn('[LeaderboardService] Failed to load remote global leaderboard, using local cache:', e);
      if (cachedEntries.length > 0) {
        return { entries: cachedEntries, lastDoc: undefined };
      }
      throw e;
    }
  },

  /**
   * Fetches rankings in a specific friend group.
   */
  getFriends: async (
    groupId: string,
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    return repo.getFriendsLeaderboard(groupId, sortBy, limit);
  },

  /**
   * Saves the current player's stats to the leaderboard.
   */
  savePlayerScore: async (
    username: string,
    level: number,
    score: number,
    coins: number,
    bestTime: number,
    avatarId?: string,
    country?: string
  ): Promise<void> => {
    // 1. Perform client-side validation
    const isValid = await ScoreValidationService.validateScore({
      levelId: level,
      score,
      coins,
      bestTime,
      difficulty: 'hard', // baseline validation
    });

    if (!isValid) {
      console.warn('[LeaderboardService] Score validation failed, rejecting save.');
      return;
    }

    // 2. Commit to repository
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    await repo.saveScore({
      userId: 'player_self',
      username: username || 'Player',
      level,
      score,
      coins,
      bestTime,
      avatarId: avatarId || 'avatar_1',
      country: country || '',
    });
  },

  /**
   * Creates a new custom friend group and returns it.
   */
  createGroup: async (
    name: string,
    description: string,
    isPublic: boolean,
    maxMembers: number
  ): Promise<LeaderboardGroup> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    return repo.createGroup(name, description, isPublic, maxMembers);
  },

  /**
   * Joins an existing group using its Invite Code.
   */
  joinGroup: async (inviteCode: string): Promise<LeaderboardGroup> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    return repo.joinGroup(inviteCode);
  },

  /**
   * Leaves an existing group.
   */
  leaveGroup: async (groupId: string): Promise<void> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    await repo.leaveGroup(groupId);
  },

  /**
   * Deletes a group.
   */
  deleteGroup: async (groupId: string): Promise<void> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    await repo.deleteGroup(groupId);
  },

  /**
   * Fetches all custom friend groups joined or created.
   */
  getGroups: async (): Promise<LeaderboardGroup[]> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    return repo.getGroups();
  },
};
