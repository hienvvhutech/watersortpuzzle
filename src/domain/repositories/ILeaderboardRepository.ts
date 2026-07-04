import { LeaderboardEntry, LeaderboardGroup } from '../types';

/**
 * Interface defining the Leaderboard repository.
 * Decoupled from the storage engine (ready to swap in Firebase Firestore).
 */
export interface ILeaderboardRepository {
  /**
   * Fetches global rankings sorted by a specific category.
   */
  getGlobalLeaderboard(
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number
  ): Promise<LeaderboardEntry[]>;

  /**
   * Fetches friend rankings within a specific group sorted by a category.
   */
  getFriendsLeaderboard(
    groupId: string,
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number
  ): Promise<LeaderboardEntry[]>;

  /**
   * Saves or updates the player's own score entry.
   */
  saveScore(entry: Omit<LeaderboardEntry, 'rank'>): Promise<void>;

  /**
   * Creates a custom group of friends.
   */
  createGroup(name: string, friends: string[]): Promise<LeaderboardGroup>;

  /**
   * Fetches all custom groups created by the player.
   */
  getGroups(): Promise<LeaderboardGroup[]>;
}
