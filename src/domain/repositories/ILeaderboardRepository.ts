import { LeaderboardEntry, LeaderboardGroup } from '../types';

/**
 * Interface defining the Leaderboard repository.
 * Decoupled from the storage engine (ready to swap in Firebase Firestore).
 */
export interface ILeaderboardRepository {
  /**
   * Fetches global rankings sorted by a specific category.
   * Supports optional DocumentSnapshot cursor for pagination.
   */
  getGlobalLeaderboard(
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limit: number,
    lastVisibleDoc?: any
  ): Promise<{ entries: LeaderboardEntry[]; lastDoc?: any }>;

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
  createGroup(
    name: string,
    description: string,
    isPublic: boolean,
    maxMembers: number
  ): Promise<LeaderboardGroup>;

  /**
   * Joins an existing group using its Invite Code.
   */
  joinGroup(inviteCode: string): Promise<LeaderboardGroup>;

  /**
   * Leaves an existing group.
   */
  leaveGroup(groupId: string): Promise<void>;

  /**
   * Deletes a group (only allowed by the owner).
   */
  deleteGroup(groupId: string): Promise<void>;

  /**
   * Fetches all groups joined or created by the player.
   */
  getGroups(): Promise<LeaderboardGroup[]>;
}
