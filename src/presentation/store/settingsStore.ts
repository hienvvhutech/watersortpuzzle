import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameSettings } from '../../domain/types';

interface SettingsActions {
  setSoundEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  setLanguage: (lang: GameSettings['language']) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export type SettingsStore = GameSettings & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      language: 'en',
      notificationsEnabled: true,

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setVibrationEnabled: (vibrationEnabled) => set({ vibrationEnabled }),
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'wsp-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Implement migrations here when updating production state schemas
        return persistedState as any;
      },
    }
  )
);
