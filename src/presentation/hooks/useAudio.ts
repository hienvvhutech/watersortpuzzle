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

// Global cache of pre-created players to prevent native allocation lags during gameplay
const sfxPlayers: Record<string, AudioPlayer> = {};

const getPlayer = (name: keyof typeof SOUND_ASSETS): AudioPlayer => {
  if (!sfxPlayers[name]) {
    sfxPlayers[name] = createAudioPlayer(SOUND_ASSETS[name]);
  }
  return sfxPlayers[name];
};

export const useAudio = () => {
  const { soundEnabled, musicEnabled } = useSettingsStore();
  const bgmSoundRef = useRef<AudioPlayer | null>(null);

  // Play a one-shot SFX sound (Reuses global players to avoid runtime allocations)
  const playSound = async (name: keyof typeof SOUND_ASSETS) => {
    if (!soundEnabled) return;
    
    try {
      const player = getPlayer(name);
      player.seekTo(0);
      player.play();
    } catch (e) {
      console.warn(`Failed to play sound: ${name}`, e);
    }
  };

  // Start background music loop
  const startBgm = async () => {
    if (!musicEnabled) return;
    if (bgmSoundRef.current) return; // Already playing

    try {
      const player = getPlayer('bgm');
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
