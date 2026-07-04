import { ISocialRepository } from '../domain/repositories/ISocialRepository';
import { FriendProfile, FriendRequest, BattleInvite } from '../domain/types';
import { auth, db } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

export class FirestoreSocialRepository implements ISocialRepository {
  private uid: string | null = null;

  private async ensureAuthenticated(): Promise<string> {
    if (this.uid) return this.uid;
    if (!auth) throw new Error('Firebase Auth not initialized.');
    if (auth.currentUser) {
      this.uid = auth.currentUser.uid;
      return this.uid;
    }
    const cred = await signInAnonymously(auth);
    this.uid = cred.user.uid;
    return this.uid;
  }

  // ─── Player Search ──────────────────────────────────────────────────────
  async searchPlayers(queryStr: string): Promise<FriendProfile[]> {
    if (!db || !queryStr.trim()) return [];
    try {
      const uid = await this.ensureAuthenticated();
      const term = queryStr.trim();
      // Firestore prefix search: displayName >= term AND < term + '\uf8ff'
      const q = query(
        collection(db, 'profiles'),
        where('displayName', '>=', term),
        where('displayName', '<=', term + '\uf8ff'),
        limit(20)
      );
      const snap = await getDocs(q);
      const results: FriendProfile[] = [];
      snap.forEach((docSnap) => {
        if (docSnap.id === uid) return; // exclude self
        const data = docSnap.data();
        results.push({
          uid: docSnap.id,
          displayName: data.displayName || 'Anonymous',
          avatarId: data.avatarId || 'avatar_1',
          country: data.country || '',
          highestLevel: data.highestLevel || 0,
          totalScore: data.totalScore || 0,
          isOnline: data.isOnline || false,
          lastSeenAt: data.lastSeenAt || '',
        });
      });
      return results;
    } catch (e) {
      console.warn('[FirestoreSocialRepository] searchPlayers error:', e);
      return [];
    }
  }

  // ─── Friend Requests ────────────────────────────────────────────────────
  async sendFriendRequest(toUid: string): Promise<void> {
    if (!db) return;
    const uid = await this.ensureAuthenticated();
    // Check not already friends or request pending
    const myProfile = await getDoc(doc(db, 'profiles', uid));
    const friendsList: string[] = myProfile.data()?.friends || [];
    if (friendsList.includes(toUid)) throw new Error('already_friends');

    // Check no existing pending request
    const existQ = query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', uid),
      where('toUid', '==', toUid),
      where('status', '==', 'pending')
    );
    const existing = await getDocs(existQ);
    if (!existing.empty) throw new Error('request_already_sent');

    const senderData = myProfile.data();
    await addDoc(collection(db, 'friendRequests'), {
      fromUid: uid,
      toUid,
      fromDisplayName: senderData?.displayName || 'Anonymous',
      fromAvatarId: senderData?.avatarId || 'avatar_1',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  async acceptFriendRequest(requestId: string): Promise<void> {
    if (!db) return;
    const uid = await this.ensureAuthenticated();
    const reqRef = doc(db, 'friendRequests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('request_not_found');

    const { fromUid, toUid } = reqSnap.data();
    if (toUid !== uid) throw new Error('not_authorized');

    // Update request status
    await updateDoc(reqRef, { status: 'accepted' });

    // Mutual friend: add each UID to the other's friends array
    await updateDoc(doc(db, 'profiles', uid), { friends: arrayUnion(fromUid) });
    await updateDoc(doc(db, 'profiles', fromUid), { friends: arrayUnion(uid) });
  }

  async rejectFriendRequest(requestId: string): Promise<void> {
    if (!db) return;
    const uid = await this.ensureAuthenticated();
    const reqRef = doc(db, 'friendRequests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (reqSnap.exists() && reqSnap.data().toUid === uid) {
      await updateDoc(reqRef, { status: 'rejected' });
    }
  }

  async getIncomingRequests(): Promise<FriendRequest[]> {
    if (!db) return [];
    try {
      const uid = await this.ensureAuthenticated();
      const q = query(
        collection(db, 'friendRequests'),
        where('toUid', '==', uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const results: FriendRequest[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as FriendRequest);
      });
      return results;
    } catch (e) {
      console.warn('[FirestoreSocialRepository] getIncomingRequests error:', e);
      return [];
    }
  }

  async getOutgoingRequests(): Promise<FriendRequest[]> {
    if (!db) return [];
    try {
      const uid = await this.ensureAuthenticated();
      const q = query(
        collection(db, 'friendRequests'),
        where('fromUid', '==', uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const results: FriendRequest[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as FriendRequest);
      });
      return results;
    } catch (e) {
      return [];
    }
  }

  // ─── Friends List ────────────────────────────────────────────────────────
  async getFriends(): Promise<FriendProfile[]> {
    if (!db) return [];
    try {
      const uid = await this.ensureAuthenticated();
      const mySnap = await getDoc(doc(db, 'profiles', uid));
      const friendUids: string[] = mySnap.data()?.friends || [];
      if (friendUids.length === 0) return [];

      const friends: FriendProfile[] = [];
      for (const fUid of friendUids) {
        const fSnap = await getDoc(doc(db, 'profiles', fUid));
        if (fSnap.exists()) {
          const data = fSnap.data();
          // Consider online if lastSeenAt is within last 2 minutes
          const lastSeen = data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : 0;
          const isOnline = data.isOnline === true && (Date.now() - lastSeen < 120000);
          friends.push({
            uid: fUid,
            displayName: data.displayName || 'Anonymous',
            avatarId: data.avatarId || 'avatar_1',
            country: data.country || '',
            highestLevel: data.highestLevel || 0,
            totalScore: data.totalScore || 0,
            isOnline,
            lastSeenAt: data.lastSeenAt || '',
          });
        }
      }
      // Sort: online friends first
      return friends.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
    } catch (e) {
      console.warn('[FirestoreSocialRepository] getFriends error:', e);
      return [];
    }
  }

  async removeFriend(friendUid: string): Promise<void> {
    if (!db) return;
    const uid = await this.ensureAuthenticated();
    await updateDoc(doc(db, 'profiles', uid), { friends: arrayRemove(friendUid) });
    await updateDoc(doc(db, 'profiles', friendUid), { friends: arrayRemove(uid) });
  }

  // ─── Online Presence ─────────────────────────────────────────────────────
  async setOnline(): Promise<void> {
    if (!db) return;
    try {
      const uid = await this.ensureAuthenticated();
      await updateDoc(doc(db, 'profiles', uid), {
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
      });
    } catch (e) {}
  }

  async setOffline(): Promise<void> {
    if (!db) return;
    try {
      const uid = await this.ensureAuthenticated();
      await updateDoc(doc(db, 'profiles', uid), {
        isOnline: false,
        lastSeenAt: new Date().toISOString(),
      });
    } catch (e) {}
  }

  // ─── Battle Invites ───────────────────────────────────────────────────────
  async sendBattleInvite(toUid: string, roomId: string): Promise<BattleInvite> {
    if (!db) throw new Error('Firestore not initialized');
    const uid = await this.ensureAuthenticated();
    const mySnap = await getDoc(doc(db, 'profiles', uid));
    const myName = mySnap.data()?.displayName || 'Anonymous';

    const ref = await addDoc(collection(db, 'battleInvites'), {
      fromUid: uid,
      toUid,
      fromDisplayName: myName,
      roomId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return {
      id: ref.id,
      fromUid: uid,
      toUid,
      fromDisplayName: myName,
      roomId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  async getIncomingBattleInvites(): Promise<BattleInvite[]> {
    if (!db) return [];
    try {
      const uid = await this.ensureAuthenticated();
      const q = query(
        collection(db, 'battleInvites'),
        where('toUid', '==', uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      const results: BattleInvite[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as BattleInvite);
      });
      return results;
    } catch (e) {
      return [];
    }
  }

  async respondBattleInvite(inviteId: string, accept: boolean): Promise<void> {
    if (!db) return;
    await updateDoc(doc(db, 'battleInvites', inviteId), {
      status: accept ? 'accepted' : 'declined',
    });
  }
}
