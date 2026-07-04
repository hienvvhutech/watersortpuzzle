import { useEffect, useRef } from 'react';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
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
  const bgmSoundRef = useRef<AudioPlayer | null>(null);

  // Play a one-shot SFX sound
  const playSound = async (name: keyof typeof SOUND_ASSETS) => {
    if (!soundEnabled) return;
    
    try {
      const asset = SOUND_ASSETS[name];
      if (!asset) return;

      const player = createAudioPlayer(asset);
      player.play();
      
      // Auto release sound after 3 seconds to prevent native memory leaks
      setTimeout(() => {
        try {
          player.release();
        } catch (e) {}
      }, 3000);
    } catch (e) {
      console.warn(`Failed to play sound: ${name}`, e);
    }
  };

  // Start background music loop
  const startBgm = async () => {
    if (!musicEnabled) return;
    if (bgmSoundRef.current) return; // Already playing

    try {
      const player = createAudioPlayer(SOUND_ASSETS.bgm);
      player.loop = true;
      player.volume = 0.4;
      player.play();
      bgmSoundRef.current = player;
    } catch (e) {
      console.warn('Failed to start BGM', e);
    }
  };

  // Stop background music loop
  const stopBgm = async () => {
    if (!bgmSoundRef.current) return;
    try {
      bgmSoundRef.current.pause();
      bgmSoundRef.current.release();
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
