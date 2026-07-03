import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateStorage } from 'zustand/middleware';
import { computeHash } from '../shared/security';
import { SAVE_VERSION } from '../config/SaveVersion';

export const SaveService = {
  /**
   * Creates a secure, version-checked StateStorage adapter for Zustand.
   */
  createSecureStorage: (storeName: string, version: number = SAVE_VERSION): StateStorage => {
    return {
      getItem: async (name: string): Promise<string | null> => {
        try {
          const raw = await AsyncStorage.getItem(name);
          if (!raw) return null;

          const parsed = JSON.parse(raw);
          const { state, hash, saveVersion } = parsed;

          // 1. Verify Hash Integrity
          const expectedHash = computeHash(JSON.stringify(state));
          if (hash !== expectedHash) {
            console.warn(`[SaveService] Save validation failed for ${storeName}! State might be tampered.`);
            return null; // Fallback to default state
          }

          // 2. Verify Save Version
          if (saveVersion !== undefined && saveVersion < version) {
            console.info(`[SaveService] Migrating store ${storeName} from v${saveVersion} to v${version}`);
            // Can execute custom migrations if necessary
          }

          return JSON.stringify(state);
        } catch (e) {
          console.error(`[SaveService] Error reading secure storage for ${storeName}:`, e);
          return null;
        }
      },

      setItem: async (name: string, value: string): Promise<void> => {
        try {
          const stateObj = JSON.parse(value);

          // Strip runtime transient UI selections before saving to storage
          if (stateObj && stateObj.state) {
            delete stateObj.state.selectedTubeIndex;
            delete stateObj.state.isPlaying;
          }

          const stateStr = JSON.stringify(stateObj);
          const hash = computeHash(stateStr);

          const wrapper = JSON.stringify({
            state: stateObj,
            hash,
            saveVersion: version,
          });

          await AsyncStorage.setItem(name, wrapper);
        } catch (e) {
          console.error(`[SaveService] Error writing secure storage for ${storeName}:`, e);
        }
      },

      removeItem: async (name: string): Promise<void> => {
        await AsyncStorage.removeItem(name);
      },
    };
  },
};
