import { IProfileRepository } from '../domain/repositories/IProfileRepository';
import { PlayerProfile } from '../domain/types';
import { auth, db, isConfigured } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const LOCAL_CACHE_KEY = 'wsp_cached_player_profile';

export class FirestoreProfileRepository implements IProfileRepository {
  private uid: string | null = null;

  /**
   * Helper to ensure the anonymous sign-in is initialized and returns the Firebase UID.
   */
  private async ensureAuthenticated(): Promise<string> {
    if (this.uid) return this.uid;
    if (!auth) {
      throw new Error('Firebase Auth is not initialized.');
    }

    let attempt = 0;
    const maxRetries = 3;
    while (attempt < maxRetries) {
      try {
        if (auth.currentUser) {
          this.uid = auth.currentUser.uid;
          return this.uid;
        }
        const userCredential = await signInAnonymously(auth);
        this.uid = userCredential.user.uid;
        return this.uid;
      } catch (e) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error('[FirestoreProfileRepository] Anonymous auth failed after retries:', e);
          throw e;
        }
        // Wait 1 second before retrying
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    throw new Error('Authentication failed');
  }

  async getProfile(): Promise<PlayerProfile | null> {
    // 1. Fetch from AsyncStorage local cache first for instant load!
    const cached = await AsyncStorage.getItem(LOCAL_CACHE_KEY);
    let localProfile: PlayerProfile | null = null;
    if (cached) {
      try {
        localProfile = JSON.parse(cached);
      } catch (e) {}
    }

    // 2. Fetch from Firestore online and merge/update cache
    try {
      const uid = await this.ensureAuthenticated();
      if (db) {
        const docRef = doc(db, 'profiles', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const remoteData = docSnap.data() as PlayerProfile;
          // Sync/save to local cache
          await AsyncStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(remoteData));
          return remoteData;
        }
      }
    } catch (e) {
      console.warn('[FirestoreProfileRepository] Failed to fetch remote profile, using local cache:', e);
    }

    return localProfile;
  }

  async saveProfile(profile: PlayerProfile): Promise<void> {
    // Sanitize profile to remove any functions (Zustand actions)
    const cleanProfile: any = {};
    for (const key of Object.keys(profile)) {
      if (typeof (profile as any)[key] !== 'function') {
        cleanProfile[key] = (profile as any)[key];
      }
    }

    // 1. Instantly save to local AsyncStorage cache
    await AsyncStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cleanProfile));

    // 2. Write to Firestore with retry wrapper
    try {
      const uid = await this.ensureAuthenticated();
      // Ensure the profile object has the Firebase UID
      const updatedProfile = {
        ...cleanProfile,
        playerId: uid,
        updatedAt: new Date().toISOString(),
      };

      // Update local cache with the new UID
      await AsyncStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updatedProfile));

      if (db) {
        const docRef = doc(db, 'profiles', uid);
        
        // Execute setDoc with retry helper
        await this.executeWithRetry(() => setDoc(docRef, updatedProfile));
      }
    } catch (e) {
      console.warn('[FirestoreProfileRepository] Firestore write queued/failed:', e);
    }
  }

  async isProfileCreated(): Promise<boolean> {
    const profile = await this.getProfile();
    return !!(profile && profile.displayName);
  }

  /**
   * Helper to retry a Firestore operation up to 3 times in case of transient network errors.
   */
  private async executeWithRetry(operation: () => Promise<void>): Promise<void> {
    let attempt = 0;
    const maxRetries = 3;
    while (attempt < maxRetries) {
      try {
        await operation();
        return;
      } catch (e: any) {
        attempt++;
        if (attempt >= maxRetries) {
          const errMsg = e instanceof Error ? e.message : String(e);
          Alert.alert(
            'Lỗi kết nối / Connection Error',
            `Không thể đồng bộ hồ sơ lên máy chủ: ${errMsg}\n\nFirebase Configured: ${isConfigured ? 'YES' : 'NO'}`
          );
          throw e;
        }
        // Wait 1.5 seconds before retrying
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
  }
}
