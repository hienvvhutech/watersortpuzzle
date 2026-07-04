import { ILeaderboardRepository } from '../domain/repositories/ILeaderboardRepository';
import { LeaderboardEntry, LeaderboardGroup } from '../domain/types';
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
  orderBy,
  limit,
  startAfter,
  where,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export class FirestoreLeaderboardRepository implements ILeaderboardRepository {
  private uid: string | null = null;

  private async ensureAuthenticated(): Promise<string> {
    if (this.uid) return this.uid;
    if (!auth) throw new Error('Firebase Auth is not initialized.');

    if (auth.currentUser) {
      this.uid = auth.currentUser.uid;
      return this.uid;
    }
    const userCredential = await signInAnonymously(auth);
    this.uid = userCredential.user.uid;
    return this.uid;
  }

  async getGlobalLeaderboard(
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limitCount: number,
    lastVisibleDoc?: any
  ): Promise<{ entries: LeaderboardEntry[]; lastDoc?: any }> {
    if (!db) throw new Error('Firestore is not initialized.');

    try {
      let q = query(
        collection(db, 'profiles'),
        orderBy(sortBy, sortBy === 'bestTime' ? 'asc' : 'desc'),
        orderBy('displayName', 'asc'),
        limit(limitCount)
      );

      if (lastVisibleDoc) {
        q = query(q, startAfter(lastVisibleDoc));
      }

      const snap = await getDocs(q);
      const entries: LeaderboardEntry[] = [];
      
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        entries.push({
          userId: docSnap.id,
          username: data.displayName || 'Anonymous',
          avatarId: data.avatarId || 'avatar_1',
          country: data.country || '',
          level: data.highestLevel || 0,
          score: data.totalScore || 0,
          coins: data.coins || 0,
          bestTime: data.bestTime || 999,
        });
      });

      const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : undefined;
      return { entries, lastDoc };
    } catch (e) {
      console.error('[FirestoreLeaderboardRepository] Failed to get global leaderboard:', e);
      throw e;
    }
  }

  async getFriendsLeaderboard(
    groupId: string,
    sortBy: 'level' | 'score' | 'coins' | 'bestTime',
    limitCount: number
  ): Promise<LeaderboardEntry[]> {
    if (!db) throw new Error('Firestore is not initialized.');

    try {
      // 1. Fetch group member UIDs from members subcollection
      const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
      const memberUids: string[] = [];
      membersSnap.forEach((docSnap) => {
        memberUids.push(docSnap.id);
      });

      if (memberUids.length === 0) return [];

      // 2. Fetch profiles for these UIDs
      const entries: LeaderboardEntry[] = [];
      for (const memberUid of memberUids) {
        const profileSnap = await getDoc(doc(db, 'profiles', memberUid));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          entries.push({
            userId: memberUid,
            username: data.displayName || 'Anonymous',
            avatarId: data.avatarId || 'avatar_1',
            country: data.country || '',
            level: data.highestLevel || 0,
            score: data.totalScore || 0,
            coins: data.coins || 0,
            bestTime: data.bestTime || 999,
          });
        }
      }

      // 3. Sort locally
      entries.sort((a, b) => {
        if (sortBy === 'bestTime') {
          return a.bestTime - b.bestTime;
        }
        return b[sortBy] - a[sortBy];
      });

      // 4. Assign ranks
      return entries.slice(0, limitCount).map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
    } catch (e) {
      console.error('[FirestoreLeaderboardRepository] Failed to fetch group leaderboard:', e);
      return [];
    }
  }

  async saveScore(entry: Omit<LeaderboardEntry, 'rank'>): Promise<void> {
    if (!db) return;
    try {
      const uid = await this.ensureAuthenticated();
      const profileRef = doc(db, 'profiles', uid);
      await updateDoc(profileRef, {
        totalScore: entry.score,
        highestLevel: entry.level,
        coins: entry.coins,
        bestTime: entry.bestTime,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[FirestoreLeaderboardRepository] Failed to save score online:', e);
    }
  }

  async createGroup(
    name: string,
    description: string,
    isPublic: boolean,
    maxMembers: number
  ): Promise<LeaderboardGroup> {
    if (!db) throw new Error('Firestore is not initialized.');
    const uid = await this.ensureAuthenticated();

    // 1. Generate unique Invite Code
    let inviteCode = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode));
      const snap = await getDocs(q);
      if (snap.empty) {
        isUnique = true;
      }
      attempts++;
    }

    // 2. Create Group doc
    const groupRef = doc(collection(db, 'groups'));
    const groupId = groupRef.id;
    const newGroup = {
      groupId,
      name,
      description,
      isPublic,
      maxMembers,
      inviteCode,
      ownerUid: uid,
      memberCount: 1,
      createdAt: new Date().toISOString(),
    };

    await setDoc(groupRef, newGroup);

    // 3. Add to members subcollection
    await setDoc(doc(db, 'groups', groupId, 'members', uid), {
      uid,
      role: 'OWNER',
      joinedAt: new Date().toISOString(),
    });

    // 4. Update owner's profile joinedGroups array
    await updateDoc(doc(db, 'profiles', uid), {
      joinedGroups: arrayUnion(groupId)
    });

    return {
      id: groupId,
      name,
      friends: [], // backward compatibility
      description,
      isPublic,
      maxMembers,
      inviteCode,
      ownerUid: uid,
      memberCount: 1,
      createdAt: newGroup.createdAt,
    };
  }

  async joinGroup(inviteCode: string): Promise<LeaderboardGroup> {
    if (!db) throw new Error('Firestore is not initialized.');
    const uid = await this.ensureAuthenticated();

    // 1. Query group by invite code
    const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error('Group not found');
    }

    const groupDoc = snap.docs[0];
    const groupData = groupDoc.data();
    const groupId = groupDoc.id;

    if (groupData.memberCount >= (groupData.maxMembers || 50)) {
      throw new Error('Group is already full');
    }

    // 2. Add to members subcollection
    await setDoc(doc(db, 'groups', groupId, 'members', uid), {
      uid,
      role: 'MEMBER',
      joinedAt: new Date().toISOString(),
    });

    // 3. Increment memberCount
    await updateDoc(doc(db, 'groups', groupId), {
      memberCount: increment(1),
    });

    // 4. Update player's profile joinedGroups
    await updateDoc(doc(db, 'profiles', uid), {
      joinedGroups: arrayUnion(groupId)
    });

    return {
      id: groupId,
      name: groupData.name,
      friends: [],
      description: groupData.description,
      isPublic: groupData.isPublic,
      maxMembers: groupData.maxMembers,
      inviteCode: groupData.inviteCode,
      ownerUid: groupData.ownerUid,
      memberCount: (groupData.memberCount || 1) + 1,
      createdAt: groupData.createdAt,
    };
  }

  async leaveGroup(groupId: string): Promise<void> {
    if (!db) return;
    try {
      const uid = await this.ensureAuthenticated();

      // 1. Delete member document
      await deleteDoc(doc(db, 'groups', groupId, 'members', uid));

      // 2. Decrement count
      await updateDoc(doc(db, 'groups', groupId), {
        memberCount: increment(-1),
      });

      // 3. Update player's profile joinedGroups
      await updateDoc(doc(db, 'profiles', uid), {
        joinedGroups: arrayRemove(groupId)
      });
    } catch (e) {
      console.warn('[FirestoreLeaderboardRepository] Failed to leave group:', e);
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    if (!db) return;
    try {
      const uid = await this.ensureAuthenticated();
      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(groupRef);

      if (groupSnap.exists() && groupSnap.data().ownerUid === uid) {
        // Delete group document
        await deleteDoc(groupRef);

        // Update owner profile
        await updateDoc(doc(db, 'profiles', uid), {
          joinedGroups: arrayRemove(groupId)
        });
      } else {
        throw new Error('Not authorized to delete this group');
      }
    } catch (e) {
      console.warn('[FirestoreLeaderboardRepository] Failed to delete group:', e);
      throw e;
    }
  }

  async getGroups(): Promise<LeaderboardGroup[]> {
    if (!db) return [];
    try {
      const uid = await this.ensureAuthenticated();
      const profileSnap = await getDoc(doc(db, 'profiles', uid));
      if (!profileSnap.exists()) return [];

      const joinedGroupIds: string[] = profileSnap.data().joinedGroups || [];
      const list: LeaderboardGroup[] = [];

      for (const groupId of joinedGroupIds) {
        const groupSnap = await getDoc(doc(db, 'groups', groupId));
        if (groupSnap.exists()) {
          const data = groupSnap.data();
          list.push({
            id: groupId,
            name: data.name,
            friends: [],
            description: data.description,
            isPublic: data.isPublic,
            maxMembers: data.maxMembers,
            inviteCode: data.inviteCode,
            ownerUid: data.ownerUid,
            memberCount: data.memberCount,
            createdAt: data.createdAt,
          });
        }
      }
      return list;
    } catch (e) {
      console.warn('[FirestoreLeaderboardRepository] Failed to fetch groups:', e);
      return [];
    }
  }
}
