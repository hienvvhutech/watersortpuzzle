import { services } from '../shared/IServiceRegistry';
import { ISocialRepository } from '../domain/repositories/ISocialRepository';
import { FriendProfile, FriendRequest, BattleInvite } from '../domain/types';

/**
 * Service managing Social operations.
 * All writes go through this service — UI never writes to Firestore directly.
 */
export const SocialService = {
  // ─── Player Search ────────────────────────────────────────────────────────
  searchPlayers: async (queryStr: string): Promise<FriendProfile[]> => {
    const repo = services.get<ISocialRepository>('Social');
    return repo.searchPlayers(queryStr);
  },

  // ─── Friend Requests ──────────────────────────────────────────────────────
  sendFriendRequest: async (toUid: string): Promise<void> => {
    const repo = services.get<ISocialRepository>('Social');
    await repo.sendFriendRequest(toUid);
  },

  acceptFriendRequest: async (requestId: string): Promise<void> => {
    const repo = services.get<ISocialRepository>('Social');
    await repo.acceptFriendRequest(requestId);
  },

  rejectFriendRequest: async (requestId: string): Promise<void> => {
    const repo = services.get<ISocialRepository>('Social');
    await repo.rejectFriendRequest(requestId);
  },

  getIncomingRequests: async (): Promise<FriendRequest[]> => {
    const repo = services.get<ISocialRepository>('Social');
    return repo.getIncomingRequests();
  },

  // ─── Friends List ─────────────────────────────────────────────────────────
  getFriends: async (): Promise<FriendProfile[]> => {
    const repo = services.get<ISocialRepository>('Social');
    return repo.getFriends();
  },

  removeFriend: async (friendUid: string): Promise<void> => {
    const repo = services.get<ISocialRepository>('Social');
    await repo.removeFriend(friendUid);
  },

  // ─── Online Presence ──────────────────────────────────────────────────────
  setOnline: async (): Promise<void> => {
    try {
      const repo = services.get<ISocialRepository>('Social');
      await repo.setOnline();
    } catch (e) {}
  },

  setOffline: async (): Promise<void> => {
    try {
      const repo = services.get<ISocialRepository>('Social');
      await repo.setOffline();
    } catch (e) {}
  },

  // ─── Battle Invites ───────────────────────────────────────────────────────
  sendBattleInvite: async (toUid: string, roomId: string): Promise<BattleInvite> => {
    const repo = services.get<ISocialRepository>('Social');
    return repo.sendBattleInvite(toUid, roomId);
  },

  getIncomingBattleInvites: async (): Promise<BattleInvite[]> => {
    const repo = services.get<ISocialRepository>('Social');
    return repo.getIncomingBattleInvites();
  },

  respondBattleInvite: async (inviteId: string, accept: boolean): Promise<void> => {
    const repo = services.get<ISocialRepository>('Social');
    await repo.respondBattleInvite(inviteId, accept);
  },
};
