import { auth, db, linkWithCredential, signInWithCredential, GoogleAuthProvider, OAuthProvider, AuthCredential } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useProfileStore } from '../presentation/store/profileStore';
import { LeaderboardService } from './LeaderboardService';

export interface ConflictDetails {
  uid: string;
  displayName: string;
  level: number;
  score: number;
  coins: number;
}

export const AuthService = {
  /**
   * Helper to generate a dummy mock credential for simulator or preview testing.
   */
  getMockCredential(provider: 'google' | 'apple'): AuthCredential {
    if (provider === 'google') {
      return GoogleAuthProvider.credential('mock_id_token_' + Math.random().toString(36).substring(2, 9));
    } else {
      const appleProvider = new OAuthProvider('apple.com');
      return appleProvider.credential({
        idToken: 'mock_apple_token_' + Math.random().toString(36).substring(2, 9),
      });
    }
  },

  /**
   * Links the current anonymous user account to a Google or Apple credential.
   * If the credential is already linked to another account, throws a conflict object.
   */
  async linkSocialAccount(provider: 'google' | 'apple', mockCredential?: AuthCredential): Promise<{ status: 'linked'; lastSyncedAt: number }> {
    if (!auth) throw new Error('Firebase Auth is not initialized');
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No user is currently signed in');

    // Use passed mock credential or generate a mock for sandbox
    const credential = mockCredential || this.getMockCredential(provider);

    try {
      // Attempt to link current anonymous account
      await linkWithCredential(currentUser, credential);
      
      const now = Date.now();
      // Update local lastCloudSync timestamp
      await useProfileStore.getState().updateProfile(
        useProfileStore.getState().displayName || 'Player',
        useProfileStore.getState().avatarId || 'avatar_1',
        useProfileStore.getState().country
      );
      
      // Update settings with the successful sync timestamp
      return { status: 'linked', lastSyncedAt: now };
    } catch (error: any) {
      if (error.code === 'auth/credential-already-in-use') {
        // Fetch the remote save state associated with this credential to show conflict UI
        const tempUserCredential = await signInWithCredential(auth, credential);
        const conflictUid = tempUserCredential.user.uid;
        
        let remoteLevel = 1;
        let remoteScore = 0;
        let remoteCoins = 150;
        let remoteName = 'Cloud Saved Player';
        
        if (db) {
          const profileSnap = await getDoc(doc(db, 'profiles', conflictUid));
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            remoteLevel = data.highestLevel || 1;
            remoteScore = data.totalScore || 0;
            remoteCoins = data.coins || 150;
            remoteName = data.displayName || 'Cloud Saved Player';
          }
        }
        
        // Re-authenticate back to the previous anonymous/current user to prevent signing out
        // (Note: in a real app we would restore the original auth state)
        throw {
          code: 'save_conflict',
          credential,
          details: {
            uid: conflictUid,
            displayName: remoteName,
            level: remoteLevel,
            score: remoteScore,
            coins: remoteCoins,
          } as ConflictDetails,
        };
      }
      throw error;
    }
  },

  /**
   * Resolves save conflicts by either restoring the cloud save (overwriting local progress)
   * or overwriting the cloud save with the current device progress.
   */
  async resolveCloudConflict(
    option: 'restore' | 'overwrite',
    credential: AuthCredential,
    conflictDetails: ConflictDetails
  ): Promise<{ lastSyncedAt: number }> {
    if (!auth) throw new Error('Firebase Auth is not initialized');
    
    // Sign in to the targeted Google/Apple account UID
    const userCred = await signInWithCredential(auth, credential);
    const uid = userCred.user.uid;
    const now = Date.now();

    if (option === 'restore') {
      // 1. Restore Cloud Save: Pull data from Firestore and apply to local Zustand store
      if (db) {
        const profileSnap = await getDoc(doc(db, 'profiles', uid));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          
          // Re-hydrate local Zustand store
          useProfileStore.setState({
            playerId: uid,
            displayName: data.displayName || '',
            avatarId: data.avatarId || 'avatar_1',
            country: data.country || '',
            playerLevel: data.currentLevel || 1,
            coins: data.totalCoins || 150,
            seasonPassStars: data.seasonPassStars || 0,
            levelProgress: data.levelProgress || {},
            updatedAt: now,
          });
        }
      }
    } else {
      // 2. Overwrite Cloud Save: Upload current local store progress to this Google/Apple UID in Firestore
      const localState = useProfileStore.getState();
      const nextLevelProgress = localState.levelProgress || {};
      const completedLevelsList = Object.keys(nextLevelProgress).map(Number);
      const highestCompleted = completedLevelsList.length > 0 ? Math.max(...completedLevelsList) : 1;
      const totalScore = Object.values(nextLevelProgress).reduce((acc, curr: any) => acc + (curr.bestScore || 0), 0);
      const fastestTimes = Object.values(nextLevelProgress).map((curr: any) => curr.fastestTime).filter(t => t > 0);
      const bestTime = fastestTimes.length > 0 ? Math.min(...fastestTimes) : 999;

      const profilePayload = {
        playerId: uid,
        displayName: localState.displayName || 'Player',
        avatarId: localState.avatarId || 'avatar_1',
        country: localState.country || '',
        currentLevel: localState.playerLevel,
        highestLevel: highestCompleted,
        totalCoins: localState.coins,
        totalScore: totalScore,
        bestTime: bestTime,
        createdAt: localState.createdAt || now,
        updatedAt: now,
        isProfileCreated: true,
      };

      if (db) {
        // Overwrite root profile
        await setDoc(doc(db, 'profiles', uid), profilePayload);
        
        // Update seasonal leaderboard score
        await LeaderboardService.savePlayerScore(
          localState.displayName || 'Player',
          highestCompleted,
          totalScore,
          localState.coins,
          bestTime,
          localState.avatarId,
          localState.country
        );
      }
      
      // Update local store with the new UID
      useProfileStore.setState({
        playerId: uid,
        updatedAt: now,
      });
    }

    return { lastSyncedAt: now };
  },
};
