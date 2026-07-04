import { FriendProfile, FriendRequest, BattleInvite } from '../types';

/**
 * Interface defining the Social repository.
 * Decoupled from backend providers (ready to swap Firestore → ASP.NET Core).
 */
export interface ISocialRepository {
  // ─── Player Search ─────────────────────────────────────────────────────
  /**
   * Search players by display name prefix (case-insensitive, top 20).
   */
  searchPlayers(query: string): Promise<FriendProfile[]>;

  // ─── Friend Requests ──────────────────────────────────────────────────
  /**
   * Send a friend request to another player by UID.
   */
  sendFriendRequest(toUid: string): Promise<void>;

  /**
   * Accept a pending friend request.
   */
  acceptFriendRequest(requestId: string): Promise<void>;

  /**
   * Reject a pending friend request.
   */
  rejectFriendRequest(requestId: string): Promise<void>;

  /**
   * Fetch incoming pending friend requests for the current player.
   */
  getIncomingRequests(): Promise<FriendRequest[]>;

  /**
   * Fetch outgoing pending friend requests sent by the current player.
   */
  getOutgoingRequests(): Promise<FriendRequest[]>;

  // ─── Friends List ─────────────────────────────────────────────────────
  /**
   * Fetch the full friends list with their live profile snapshots.
   */
  getFriends(): Promise<FriendProfile[]>;

  /**
   * Remove a friend.
   */
  removeFriend(friendUid: string): Promise<void>;

  // ─── Online Presence ──────────────────────────────────────────────────
  /**
   * Mark the current player as online. Should be called on app foreground.
   */
  setOnline(): Promise<void>;

  /**
   * Mark the current player as offline. Should be called on app background.
   */
  setOffline(): Promise<void>;

  // ─── Battle Invites ───────────────────────────────────────────────────
  /**
   * Send a battle invite to a friend.
   */
  sendBattleInvite(toUid: string, roomId: string): Promise<BattleInvite>;

  /**
   * Fetch pending battle invites received by the current player.
   */
  getIncomingBattleInvites(): Promise<BattleInvite[]>;

  /**
   * Accept or decline a battle invite.
   */
  respondBattleInvite(inviteId: string, accept: boolean): Promise<void>;
}
