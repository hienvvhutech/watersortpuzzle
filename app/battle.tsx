import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../src/presentation/store/gameStore';
import { useProfileStore } from '../src/presentation/store/profileStore';
import { GameBoard } from '../src/presentation/components/GameBoard';
import { ConfettiEffect } from '../src/presentation/components/ParticleEffect';
import { useAudio } from '../src/presentation/hooks/useAudio';
import { useHaptics } from '../src/presentation/hooks/useHaptics';
import { THEMES } from '../src/presentation/themes';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { GameBackground } from '../src/presentation/components/GameBackground';
import { useTranslation } from '../src/shared/i18n';
import { services, IBattleService } from '../src/shared/IServiceRegistry';
import { getAvatarEmoji } from '../src/shared/avatars';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BattleScreen() {
  const router = useRouter();
  const audio = useAudio();
  const haptics = useHaptics();
  const { t } = useTranslation();
  const params = useLocalSearchParams();

  // Extract navigation parameters
  const botDifficulty = (params.difficulty as 'easy' | 'medium' | 'hard') || 'medium';
  const mode = (params.mode as 'bot' | 'room') || 'bot';
  const roomCode = (params.roomCode as string) || '';

  // Store actions/states
  const {
    tubes,
    isWon,
    history,
    hasAddedTube,
    startLevel,
    restartLevel,
    undo,
    addEmptyTube,
    useHint,
    coins,
    addCoins,
  } = useGameStore();

  const addProfileCoins = useProfileStore((state) => state.addCoins);
  const { displayName, avatarId } = useProfileStore();

  // Battle session states
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [battleStatus, setBattleStatus] = useState<'active' | 'won' | 'lost'>('active');
  const [battleResultModalVisible, setBattleResultModalVisible] = useState(false);

  // Initialize Battle Session
  useEffect(() => {
    // Generate a fixed medium difficulty board for the duel (e.g. Level 20 schema)
    startLevel(20);

    const battleService = services.get<IBattleService>('Battle');

    // Subscribe to opponent progress updates
    battleService.onOpponentProgressUpdate((progress: number) => {
      setOpponentProgress(progress);
    });

    // Subscribe to battle state updates (victory/defeat)
    battleService.onStatusChange((status: 'waiting' | 'active' | 'won' | 'lost') => {
      if (status === 'won') {
        audio.playSound('victory');
        haptics.success();
        setBattleStatus('won');
        setBattleResultModalVisible(true);
        // Reward 100 coins
        addProfileCoins(100);
      } else if (status === 'lost') {
        audio.playSound('error');
        haptics.error();
        setBattleStatus('lost');
        setBattleResultModalVisible(true);
      }
    });

    // Start simulated duel
    if (mode === 'bot') {
      setOpponentName(t(`battle.botDiff${botDifficulty.charAt(0).toUpperCase() + botDifficulty.slice(1)}` as any));
      battleService.startBattle(botDifficulty);
    } else {
      setOpponentName('Speedy_Sorter');
      // If room mode, start duel
      battleService.startBattle('medium');
    }

    return () => {
      battleService.leaveRoom();
    };
  }, []);

  // Monitor board progress and calculate percentage sorted
  useEffect(() => {
    if (tubes.length === 0) return;

    // Calculate progress: count tubes sorted
    let sortedCount = 0;
    let filledTubes = 0;

    tubes.forEach((t) => {
      if (t.length > 0) {
        filledTubes++;
        const uniqueColors = new Set(t);
        if (t.length === 4 && uniqueColors.size === 1) {
          sortedCount++;
        }
      }
    });

    // Exclude extra added empty tube if exists to normalize calculation
    const baseFilledColors = filledTubes > 0 ? Math.max(1, filledTubes - 2) : 1;
    const progress = Math.min(100, Math.floor((sortedCount / baseFilledColors) * 100));

    setPlayerProgress(progress);

    // Update real-time progress broadcast
    const battleService = services.get<IBattleService>('Battle');
    battleService.updatePlayerProgress(progress);
  }, [tubes]);

  const handleBack = () => {
    audio.playSound('click');
    haptics.selection();
    router.replace('/');
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    audio.playSound('click');
    haptics.selection();
    undo();
  };

  const handleHint = () => {
    if (coins < 50) {
      audio.playSound('error');
      haptics.error();
      return;
    }
    const hintMove = useHint();
    if (hintMove) {
      audio.playSound('coin');
      haptics.selection();
    }
  };

  const handleAddTube = () => {
    if (hasAddedTube || coins < 100) {
      audio.playSound('error');
      haptics.error();
      return;
    }
    addCoins(-100);
    const success = addEmptyTube();
    if (success) {
      audio.playSound('coin');
      haptics.selection();
    }
  };

  return (
    <View style={styles.container}>
      <GameBackground />

      {/* Confetti celebration for victory */}
      <ConfettiEffect active={battleStatus === 'won'} />

      <SafeAreaView style={styles.safeArea}>
        {/* Battle Progress HUD Header */}
        <View style={styles.battleHeader}>
          {/* Player Progress (Left) */}
          <View style={styles.playerProgressCard}>
            <View style={styles.playerMeta}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>{getAvatarEmoji(avatarId)}</Text>
              <Text style={styles.playerUsername} numberOfLines={1}>{displayName || 'Player'}</Text>
            </View>
            <Text style={styles.playerProgressPercent}>{playerProgress}%</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${playerProgress}%`, backgroundColor: '#10b981' }]} />
            </View>
          </View>

          {/* Versus Icon */}
          <View style={styles.versusContainer}>
            <Text style={styles.versusText}>VS</Text>
          </View>

          {/* Opponent Progress (Right) */}
          <View style={styles.playerProgressCard}>
            <View style={[styles.playerMeta, { justifyContent: 'flex-end' }]}>
              <Text style={styles.playerUsername} numberOfLines={1}>{opponentName}</Text>
              <Text style={{ fontSize: 16, marginLeft: 6 }}>{mode === 'bot' ? '🤖' : '🦊'}</Text>
            </View>
            <Text style={[styles.playerProgressPercent, { textAlign: 'right' }]}>{opponentProgress}%</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${opponentProgress}%`, backgroundColor: '#ef4444', alignSelf: 'flex-end' }]} />
            </View>
          </View>
        </View>

        {/* Board Playing Zone */}
        <View style={styles.boardRegion}>
          <GameBoard />
        </View>

        {/* Action Dock Toolbar */}
        <View style={styles.toolbarRegion}>
          <View style={styles.glassDock}>
            <Pressable
              style={({ pressed }) => [styles.dockButton, history.length === 0 && styles.disabledButton, pressed && styles.pressedScale]}
              onPress={handleUndo}
              disabled={history.length === 0}
            >
              <Ionicons name="arrow-undo" size={20} color={history.length === 0 ? '#64748b' : '#e2e8f0'} />
              <Text style={[styles.dockButtonText, history.length === 0 && styles.disabledText]}>{t('game.undo')}</Text>
            </Pressable>

            <View style={styles.dockDivider} />

            <Pressable
              style={({ pressed }) => [styles.dockButton, pressed && styles.pressedScale]}
              onPress={handleHint}
            >
              <Ionicons name="bulb" size={20} color="#e2e8f0" />
              <Text style={styles.dockButtonText}>{t('game.hint')} (50)</Text>
            </Pressable>

            <View style={styles.dockDivider} />

            <Pressable
              style={({ pressed }) => [styles.dockButton, hasAddedTube && styles.disabledButton, pressed && styles.pressedScale]}
              onPress={handleAddTube}
              disabled={hasAddedTube}
            >
              <Ionicons name="add-circle" size={20} color={hasAddedTube ? '#64748b' : '#e2e8f0'} />
              <Text style={[styles.dockButtonText, hasAddedTube && styles.disabledText]}>{t('game.tube')} (100)</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* MODAL: BATTLE RESULT OVERLAY */}
      <Modal visible={battleResultModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalContent}>
            {battleStatus === 'won' ? (
              <>
                <View style={styles.trophyContainer}>
                  <FontAwesome5 name="trophy" size={40} color="#fbbf24" />
                </View>
                <Text style={styles.resultTitle}>VICTORY!</Text>
                <Text style={styles.resultSubtitle}>You sorted all tubes first!</Text>
                
                <View style={styles.rewardContainer}>
                  <FontAwesome5 name="coins" size={16} color="#fbbf24" style={{ marginRight: 8 }} />
                  <Text style={styles.rewardText}>+100 Coins</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.trophyContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <FontAwesome5 name="times-circle" size={40} color="#ef4444" />
                </View>
                <Text style={[styles.resultTitle, { color: '#ef4444' }]}>DEFEAT!</Text>
                <Text style={styles.resultSubtitle}>{opponentName} sorted all tubes first!</Text>
              </>
            )}

            <Pressable
              style={({ pressed }) => [styles.exitButton, pressed && styles.pressedScale]}
              onPress={handleBack}
            >
              <Text style={styles.exitButtonText}>EXIT TO LOBBY</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  safeArea: {
    flex: 1,
  },
  battleHeader: {
    flexDirection: 'row',
    height: '14%',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderBottomWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  playerProgressCard: {
    flex: 1,
    justifyContent: 'center',
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerUsername: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 12,
  },
  playerProgressPercent: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  versusContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  versusText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '900',
  },
  boardRegion: {
    height: '71%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarRegion: {
    height: '15%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassDock: {
    height: 68,
    width: SCREEN_WIDTH * 0.88,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dockButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  pressedScale: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  dockButtonText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  disabledText: {
    color: '#64748b',
  },
  dockDivider: {
    width: 1.2,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassModalContent: {
    width: '84%',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  trophyContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 2,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    marginBottom: 24,
  },
  rewardText: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: '800',
  },
  exitButton: {
    backgroundColor: '#10b981',
    width: '100%',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  exitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
