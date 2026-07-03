import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { useSettingsStore } from '../store/settingsStore';

const SOUND_ASSETS: Record<string, any> = {
  click: require('../../../assets/audio/click.mp3'),
  pour: require('../../../assets/audio/pour.mp3'),
  error: require('../../../assets/audio/error.mp3'),
  victory: require('../../../assets/audio/victory.mp3'),
  lose: require('../../../assets/audio/lose.mp3'),
  reward: require('../../../assets/audio/reward.mp3'),
  coin: require('../../../assets/audio/coin.mp3'),
  bgm: require('../../../assets/audio/bgm.mp3'),
};

export const useAudio = () => {
  const { soundEnabled, musicEnabled } = useSettingsStore();
  const bgmSoundRef = useRef<Audio.Sound | null>(null);

  // Play a one-shot SFX sound
  const playSound = async (name: keyof typeof SOUND_ASSETS) => {
    if (!soundEnabled) return;
    
    try {
      const asset = SOUND_ASSETS[name];
      if (!asset) return;

      const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: true });
      
      // Auto unload sound once it completes playing to prevent memory leaks
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.warn(`Failed to play sound: ${name}`, e);
    }
  };

  // Start background music loop
  const startBgm = async () => {
    if (!musicEnabled) return;
    if (bgmSoundRef.current) return; // Already playing

    try {
      const { sound } = await Audio.Sound.createAsync(
        SOUND_ASSETS.bgm,
        { shouldPlay: true, isLooping: true, volume: 0.4 }
      );
      bgmSoundRef.current = sound;
    } catch (e) {
      console.warn('Failed to start BGM', e);
    }
  };

  // Stop background music loop
  const stopBgm = async () => {
    if (!bgmSoundRef.current) return;
    try {
      await bgmSoundRef.current.stopAsync();
      await bgmSoundRef.current.unloadAsync();
      bgmSoundRef.current = null;
    } catch (e) {
      console.warn('Failed to stop BGM', e);
    }
  };

  // Synchronize BGM status with settings changes
  useEffect(() => {
    if (musicEnabled) {
      startBgm().catch(() => {});
    } else {
      stopBgm().catch(() => {});
    }
  }, [musicEnabled]);

  return {
    playSound,
    startBgm,
    stopBgm,
  };
};
