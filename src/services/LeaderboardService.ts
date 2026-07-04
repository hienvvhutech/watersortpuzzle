import { services } from '../shared/IServiceRegistry';
import { ILeaderboardRepository } from '../domain/repositories/ILeaderboardRepository';
import { LeaderboardEntry, LeaderboardGroup } from '../domain/types';

/**
 * Service managing Leaderboard operations.
 * Resolves repository dependency via the DI ServiceRegistry.
 */
export const LeaderboardService = {
  /**
   * Fetches global rankings sorted by a specific category.
   */
  getGlobal: async (
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    return repo.getGlobalLeaderboard(sortBy, limit);
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
    bestTime: number
  ): Promise<void> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    await repo.saveScore({
      userId: 'player_self',
      username: username || 'Player',
      level,
      score,
      coins,
      bestTime,
    });
  },

  /**
   * Creates a new custom friend group and returns it.
   */
  createGroup: async (name: string, friends: string[]): Promise<LeaderboardGroup> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    return repo.createGroup(name, friends);
  },

  /**
   * Fetches all custom friend groups.
   */
  getGroups: async (): Promise<LeaderboardGroup[]> => {
    const repo = services.get<ILeaderboardRepository>('Leaderboard');
    return repo.getGroups();
  },
};
