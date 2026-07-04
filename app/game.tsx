import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  ActivityIndicator,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../src/presentation/store/gameStore';
import { useSettingsStore } from '../src/presentation/store/settingsStore';
import { useProfileStore } from '../src/presentation/store/profileStore';
import { GameBoard } from '../src/presentation/components/GameBoard';
import { ConfettiEffect } from '../src/presentation/components/ParticleEffect';
import { useAudio } from '../src/presentation/hooks/useAudio';
import { useHaptics } from '../src/presentation/hooks/useHaptics';
import { THEMES } from '../src/presentation/themes';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { GameBackground } from '../src/presentation/components/GameBackground';
import { useTranslation } from '../src/shared/i18n';
import { DifficultyService } from '../src/services/DifficultyService';

export default function GameScreen() {
  const router = useRouter();
  const audio = useAudio();
  const haptics = useHaptics();
  const { width: windowWidth } = useWindowDimensions();
  const { t } = useTranslation();

  // Zustand Store variables & actions
  const {
    currentLevel,
    coins,
    isWon,
    history,
    hasAddedTube,
    startLevel,
    restartLevel,
    undo,
    addEmptyTube,
    useHint,
    addCoins,
    isPlaying,
    lastWinReward,
    carryoverTimeBonus,
    difficulty,
  } = useGameStore();

  // Settings Store for dynamic toggles
  const {
    soundEnabled,
    musicEnabled,
    vibrationEnabled,
    setSoundEnabled,
    setMusicEnabled,
    setVibrationEnabled,
  } = useSettingsStore();

  // Profile Store personal records & telemetry
  const profileProgress = useProfileStore((state) => state.levelProgress[currentLevel]);
  const {
    sessionLevelsPlayed,
    sessionTotalTime,
    sessionCoinsEarned,
    sessionXpEarned,
    sessionStarsEarned,
    sessionPerfectWins,
    sessionGoldCrowns,
    sessionNewRecords,
    resetSessionTelemetry,
  } = useProfileStore();

  const theme = THEMES.dark; // Dark gameplay theme

  // Local state
  const [hint, setHint] = useState<{ from: number; to: number } | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adAction, setAdAction] = useState<'hint' | 'tube' | null>(null);
  const [victoryModalVisible, setVictoryModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [sessionSummaryVisible, setSessionSummaryVisible] = useState(false);
  const [timeoutModalVisible, setTimeoutModalVisible] = useState(false);
  const [earnedStars, setEarnedStars] = useState(3);
  const [earnedCoins, setEarnedCoins] = useState(50);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Time calculations
  const baseTime = DifficultyService.getTargetTimeForDifficulty(difficulty);
  const timeLimit = baseTime + carryoverTimeBonus;
  const timeLeft = Math.max(0, timeLimit - elapsedTime);

  // Countdown timer effect
  useEffect(() => {
    if (isPlaying && !isWon && !timeoutModalVisible) {
      setElapsedTime(0);
      const interval = setInterval(() => {
        setElapsedTime((prev) => {
          const next = prev + 1;
          if (next >= timeLimit) {
            clearInterval(interval);
            audio.playSound('error');
            haptics.error();
            setTimeoutModalVisible(true);
          }
          return next;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, isWon, currentLevel, timeLimit, timeoutModalVisible]);

  // Warning vibrations when time is running out (<= 10 seconds)
  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0 && isPlaying && !isWon && !timeoutModalVisible) {
      haptics.selection();
    }
  }, [timeLeft]);

  // When won, show victory modal after a delay for the confetti to fall
  useEffect(() => {
    if (isWon) {
      // Calculate stars earned
      const movesTaken = history.length;
      const par = useGameStore.getState().parMoves;
      let stars = 1;
      if (movesTaken <= par + 2) {
        stars = 3;
      } else if (movesTaken <= par + 5) {
        stars = 2;
      }
      setEarnedStars(stars);

      const baseCoins = 50;
      const starBonus = stars * 10;
      const levelBonus = Math.min(20, currentLevel);
      setEarnedCoins(baseCoins + starBonus + levelBonus);

      const timer = setTimeout(() => {
        setVictoryModalVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setVictoryModalVisible(false);
      setHint(null);
    }
  }, [isWon]);

  // Clear hint banner after 6 seconds
  useEffect(() => {
    if (hint) {
      const timer = setTimeout(() => {
        setHint(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [hint]);

  const handleBack = () => {
    audio.playSound('click');
    haptics.selection();
    if (sessionLevelsPlayed > 0) {
      setSessionSummaryVisible(true);
    } else {
      router.replace('/');
    }
  };

  const handleExitToHome = () => {
    audio.playSound('click');
    haptics.selection();
    setSessionSummaryVisible(false);
    resetSessionTelemetry();
    router.replace('/');
  };

  const handleRestart = () => {
    audio.playSound('click');
    haptics.selection();
    restartLevel();
    setHint(null);
  };

  const handleTimeoutRetry = () => {
    audio.playSound('click');
    haptics.selection();
    setTimeoutModalVisible(false);
    restartLevel();
    setElapsedTime(0);
  };

  const handleTimeoutHome = () => {
    audio.playSound('click');
    haptics.selection();
    setTimeoutModalVisible(false);
    resetSessionTelemetry();
    router.replace('/');
  };

  const handleUndo = () => {
    if (history.length === 0) {
      audio.playSound('error');
      haptics.error();
      return;
    }
    const success = undo();
    if (success) {
      audio.playSound('click');
      haptics.selection();
      setHint(null);
    }
  };

  // Mock watching a Rewarded Ad
  const simulateRewardedAd = (action: 'hint' | 'tube') => {
    haptics.impactLight();
    setAdAction(action);
    setAdLoading(true);

    // Simulate ad video running for 2 seconds
    setTimeout(() => {
      setAdLoading(false);
      haptics.success();
      audio.playSound('reward');

      if (action === 'hint') {
        // Grant free hint
        addCoins(50);
        const result = useHint();
        if (result) {
          setHint(result);
        }
      } else if (action === 'tube') {
        addEmptyTube();
      }
      setAdAction(null);
    }, 2000);
  };

  const handleHint = () => {
    if (coins < 50) {
      simulateRewardedAd('hint');
      return;
    }

    const result = useHint();
    if (result) {
      audio.playSound('coin');
      haptics.selection();
      setHint(result);
    } else {
      audio.playSound('error');
      haptics.error();
    }
  };

  const handleAddTube = () => {
    if (hasAddedTube) {
      audio.playSound('error');
      haptics.error();
      return;
    }

    if (coins < 100) {
      simulateRewardedAd('tube');
      return;
    }

    // Deduct 100 coins and add tube
    addCoins(-100);
    const success = addEmptyTube();
    if (success) {
      audio.playSound('coin');
      haptics.selection();
    } else {
      addCoins(100); // Revert coins if failed
      audio.playSound('error');
      haptics.error();
    }
  };

  const handleNextLevel = () => {
    audio.playSound('click');
    haptics.selection();
    setVictoryModalVisible(false);
    startLevel(currentLevel + 1);
  };

  // Restrict UI dock width based on screen width
  const dockWidth = Math.min(windowWidth * 0.92, 440);

  return (
    <View style={styles.container}>
      {/* Premium Ambient Live Background */}
      <GameBackground />

      {/* Confetti Animation Layer */}
      <ConfettiEffect active={isWon} />

      {/* Portrait Mobile-First SafeArea layout */}
      <SafeAreaView style={styles.safeArea}>
        
        {/* Region 1: Header (10%) */}
        <View style={styles.headerRegion}>
          <View style={styles.glassHeader}>
            {/* Back Button */}
            <Pressable
              style={({ pressed }) => [styles.hudIconButton, pressed && styles.pressedScaleSmall]}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={20} color="#cbd5e1" />
            </Pressable>

            {/* Absolute Centered Level Title and Timer */}
            <View style={styles.absoluteCenteredTitle} pointerEvents="none">
              <Text style={styles.hudLevelText}>{t('home.level', { level: currentLevel })}</Text>
              <Text style={[
                styles.hudTimerText, 
                timeLeft <= 10 && styles.hudTimerWarningText
              ]}>
                {t('game.timeRemaining', { time: timeLeft })}
              </Text>
            </View>

            {/* Right Section: Coins and Settings */}
            <View style={styles.hudRightGroup}>
              <View style={styles.hudCoinsBadge}>
                <FontAwesome5 name="coins" size={12} color="#fbbf24" style={{ marginRight: 6 }} />
                <Text style={styles.hudCoinsText}>{coins}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.hudIconButton, pressed && styles.pressedScaleSmall, { marginLeft: 10 }]}
                onPress={() => {
                  audio.playSound('click');
                  haptics.selection();
                  setSettingsVisible(true);
                }}
              >
                <Ionicons name="settings-sharp" size={18} color="#cbd5e1" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Hint Alert Banner overlay */}
        {hint && (
          <View style={styles.hintBanner}>
            <View style={styles.hintBannerContent}>
              <Ionicons name="bulb" size={18} color="#fbbf24" style={{ marginRight: 8 }} />
              <Text style={styles.hintBannerText}>
                {t('game.hintTitle')}: {t('game.hintDesc', { from: hint.from + 1, to: hint.to + 1 })}
              </Text>
            </View>
          </View>
        )}

        {/* Region 2: Game Board (70%) */}
        <View style={styles.boardRegion}>
          <GameBoard />
        </View>

        {/* Region 3: Moves Counter & Ghost Replay (5%) */}
        <View style={styles.movesRegion}>
          <Text style={styles.movesText}>{t('game.moves', { moves: history.length })}</Text>
          {profileProgress && profileProgress.bestMoves > 0 && (
            <View style={styles.ghostContainer}>
              <FontAwesome5 name="ghost" size={12} color="#a78bfa" style={{ marginRight: 6 }} />
              <Text style={styles.ghostText}>
                Ghost: {profileProgress.bestMoves - history.length >= 0 
                  ? `+${profileProgress.bestMoves - history.length}` 
                  : profileProgress.bestMoves - history.length} moves | {profileProgress.fastestTime - elapsedTime >= 0 
                  ? `+${profileProgress.fastestTime - elapsedTime}s` 
                  : `${profileProgress.fastestTime - elapsedTime}s`}
              </Text>
            </View>
          )}
        </View>

        {/* Region 4: Bottom Action Bar (15%) */}
        <View style={styles.toolbarRegion}>
          <View style={[styles.glassDock, { width: dockWidth }]}>
            {/* Undo */}
            <Pressable
              style={({ pressed }) => [
                styles.dockButton,
                history.length === 0 && styles.disabledButton,
                pressed && history.length > 0 && styles.pressedScaleSmall,
              ]}
              onPress={handleUndo}
              disabled={history.length === 0}
            >
              <View style={styles.dockButtonContent}>
                <Ionicons
                  name="arrow-undo"
                  size={18}
                  color={history.length === 0 ? '#64748b' : '#e2e8f0'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.dockButtonText, history.length === 0 && styles.disabledText]}>
                  {t('game.undo')} {history.length > 0 ? `(${history.length})` : ''}
                </Text>
              </View>
            </Pressable>

            <View style={styles.dockDivider} />

            {/* Restart */}
            <Pressable
              style={({ pressed }) => [styles.dockButton, pressed && styles.pressedScaleSmall]}
              onPress={handleRestart}
            >
              <View style={styles.dockButtonContent}>
                <Ionicons name="refresh" size={18} color="#e2e8f0" style={{ marginRight: 6 }} />
                <Text style={styles.dockButtonText}>{t('game.restart')}</Text>
              </View>
            </Pressable>

            <View style={styles.dockDivider} />

            {/* Hint */}
            <Pressable
              style={({ pressed }) => [styles.dockButton, pressed && styles.pressedScaleSmall]}
              onPress={handleHint}
            >
              <View style={styles.dockButtonContent}>
                <Ionicons name="bulb" size={18} color="#e2e8f0" style={{ marginRight: 6 }} />
                <Text style={styles.dockButtonText}>{t('game.hint')}</Text>
                <View style={styles.dockCostBadge}>
                  <Text style={styles.dockCostBadgeText}>50</Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.dockDivider} />

            {/* + Tube */}
            <Pressable
              style={({ pressed }) => [
                styles.dockButton,
                hasAddedTube && styles.disabledButton,
                pressed && !hasAddedTube && styles.pressedScaleSmall,
              ]}
              onPress={handleAddTube}
              disabled={hasAddedTube}
            >
              <View style={styles.dockButtonContent}>
                <Ionicons
                  name="add-circle"
                  size={18}
                  color={hasAddedTube ? '#64748b' : '#e2e8f0'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.dockButtonText, hasAddedTube && styles.disabledText]}>{t('game.tube')}</Text>
                <View style={[styles.dockCostBadge, hasAddedTube && styles.dockCostBadgeUsed]}>
                  <Text style={styles.dockCostBadgeText}>{hasAddedTube ? 'USED' : '100'}</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

      </SafeAreaView>

      {/* MODAL: SETTINGS */}
      <Modal visible={settingsVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalContent}>
            <Text style={styles.modalTitle}>{t('settings.title')}</Text>

            <View style={styles.settingsBox}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('settings.sound')}</Text>
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('settings.music')}</Text>
                <Switch
                  value={musicEnabled}
                  onValueChange={setMusicEnabled}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('settings.vibration')}</Text>
                <Switch
                  value={vibrationEnabled}
                  onValueChange={setVibrationEnabled}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressedScaleSmall,
              ]}
              onPress={() => {
                audio.playSound('click');
                haptics.selection();
                setSettingsVisible(false);
              }}
            >
              <Text style={styles.closeButtonText}>{t('settings.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL: TIME OUT (Game Over Screen) */}
      <Modal visible={timeoutModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalContent}>
            <Ionicons name="time" size={60} color="#ef4444" style={{ marginBottom: 15 }} />
            <Text style={[styles.victoryTitle, { color: '#ef4444' }]}>{t('game.timeout.title')}</Text>
            <Text style={styles.victorySubtitle}>{t('game.timeout.desc')}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.victoryBtn,
                pressed && styles.pressedScale,
                { backgroundColor: '#3b82f6', shadowColor: '#3b82f6', marginTop: 25 }
              ]}
              onPress={handleTimeoutRetry}
            >
              <Text style={styles.victoryBtnText}>{t('game.timeout.restart')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressedScaleSmall,
                { marginTop: 15 }
              ]}
              onPress={handleTimeoutHome}
            >
              <Text style={styles.closeButtonText}>{t('game.timeout.exit')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL: VICTORY SUMMARY OVERLAY */}
      <Modal visible={victoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalContent}>
            {/* Crown Decoration */}
            <View style={styles.crownGlow}>
              <FontAwesome5 name="crown" size={36} color="#fbbf24" />
            </View>

            {/* Victory Title */}
            <Text style={styles.victoryTitle}>{t('game.victory.title')}</Text>
            <Text style={styles.victorySubtitle}>{t('game.victory.moves', { moves: history.length })}</Text>

            {/* Stars Row */}
            <View style={styles.starsRow}>
              <Ionicons name="star" size={32} color={earnedStars >= 1 ? '#fbbf24' : '#475569'} style={{ marginHorizontal: 4 }} />
              <Ionicons name="star" size={44} color={earnedStars >= 2 ? '#fbbf24' : '#475569'} style={{ marginHorizontal: 4, marginTop: -8 }} />
              <Ionicons name="star" size={32} color={earnedStars >= 3 ? '#fbbf24' : '#475569'} style={{ marginHorizontal: 4 }} />
            </View>

            {/* Score & Coins Earned Breakdown */}
            {lastWinReward && (
              <View style={styles.scoreBreakdownContainer}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Base Score</Text>
                  <Text style={styles.breakdownValue}>{lastWinReward.baseScore}</Text>
                </View>

                {lastWinReward.timeBonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('game.victory.timeBonus')}</Text>
                    <Text style={styles.breakdownValue}>+{lastWinReward.timeBonus}</Text>
                  </View>
                )}

                {lastWinReward.perfectBonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('game.victory.perfectBonus')}</Text>
                    <Text style={styles.breakdownValue}>+{lastWinReward.perfectBonus}</Text>
                  </View>
                )}

                {lastWinReward.newPerfectStreakCombo > 1 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{t('game.victory.streakBonus')} (x{lastWinReward.comboMultiplier.toFixed(1)})</Text>
                    <Text style={styles.breakdownValue}>+{lastWinReward.perfectBonus}</Text>
                  </View>
                )}

                <View style={styles.breakdownDivider} />

                {/* Coins Summary */}
                <View style={styles.victoryCoinsRow}>
                  <View style={styles.victoryCoinsContainer}>
                    <FontAwesome5 name="coins" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                    <Text style={styles.victoryCoinsVal}>+{lastWinReward.totalCoins}</Text>
                  </View>
                  <Text style={styles.victoryScoreVal}>{lastWinReward.totalScore} pts</Text>
                </View>
              </View>
            )}

            {/* Continue Button */}
            <Pressable
              style={({ pressed }) => [
                styles.victoryBtn,
                pressed && styles.pressedScale,
              ]}
              onPress={handleNextLevel}
            >
              <Text style={styles.victoryBtnText}>{t('game.victory.next')}</Text>
            </Pressable>

            {/* Victory Action Row */}
            <View style={styles.victoryActionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.victorySubButton,
                  pressed && styles.pressedScaleSmall,
                ]}
                onPress={() => {
                  setVictoryModalVisible(false);
                  handleBack();
                }}
              >
                <Ionicons name="home" size={18} color="#cbd5e1" style={{ marginRight: 6 }} />
                <Text style={styles.victorySubButtonText}>{t('game.victory.home')}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.victorySubButton,
                  pressed && styles.pressedScaleSmall,
                ]}
                onPress={() => {
                  setVictoryModalVisible(false);
                  handleRestart();
                }}
              >
                <Ionicons name="refresh" size={18} color="#cbd5e1" style={{ marginRight: 6 }} />
                <Text style={styles.victorySubButtonText}>{t('game.victory.replay')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: PLAY SESSION SUMMARY OVERLAY */}
      <Modal visible={sessionSummaryVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.sessionSummaryContent}>
            <View style={styles.sessionSummaryHeader}>
              <Ionicons name="trophy" size={26} color="#fbbf24" style={{ marginRight: 10 }} />
              <Text style={styles.sessionSummaryTitle}>{t('game.session.title')}</Text>
            </View>
            <Text style={styles.sessionSummarySub}>{t('game.session.desc')}</Text>

            <View style={styles.sessionStatsGrid}>
              <View style={styles.sessionStatCard}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.sessionStatVal}>{sessionLevelsPlayed}</Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.levelsWon')}</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="time" size={18} color="#3b82f6" />
                <Text style={styles.sessionStatVal}>
                  {sessionLevelsPlayed > 0 ? Math.floor(sessionTotalTime / sessionLevelsPlayed) : 0}s
                </Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.avgTime')}</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="ribbon" size={18} color="#fbbf24" />
                <Text style={styles.sessionStatVal}>{sessionGoldCrowns}</Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.goldCrowns')}</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <FontAwesome5 name="coins" size={16} color="#fbbf24" />
                <Text style={styles.sessionStatVal}>+{sessionCoinsEarned}</Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.coinsEarned')}</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="sparkles" size={18} color="#60a5fa" />
                <Text style={styles.sessionStatVal}>+{sessionXpEarned}</Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.xpGained')}</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="star" size={18} color="#c084fc" />
                <Text style={styles.sessionStatVal}>+{sessionStarsEarned}</Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.seasonStars')}</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="flash" size={18} color="#f43f5e" />
                <Text style={styles.sessionStatVal}>{sessionNewRecords}</Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.newRecords')}</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="medal" size={18} color="#10b981" />
                <Text style={styles.sessionStatVal}>{sessionPerfectWins}</Text>
                <Text style={styles.sessionStatLabel}>{t('game.session.perfectPlays')}</Text>
              </View>
            </View>

            <View style={styles.sessionActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.sessionExitBtn,
                  pressed && styles.pressedScale,
                ]}
                onPress={handleExitToHome}
              >
                <Text style={styles.sessionExitBtnText}>{t('game.session.exit')}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.sessionResumeBtn,
                  pressed && styles.pressedScale,
                ]}
                onPress={() => {
                  audio.playSound('click');
                  haptics.selection();
                  setSessionSummaryVisible(false);
                }}
              >
                <Text style={styles.sessionResumeBtnText}>{t('game.session.resume')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ad Loader Screen overlay */}
      {adLoading && (
        <View style={styles.adOverlay}>
          <View style={styles.adBox}>
            <ActivityIndicator size="large" color="#10b981" style={{ marginBottom: 15 }} />
            <Text style={styles.adTitle}>Loading Video Reward...</Text>
            <Text style={styles.adDesc}>Simulating ad for free {adAction} reward</Text>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  headerRegion: {
    height: '10%',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  glassHeader: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  hudIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  absoluteCenteredTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudLevelText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  hudTimerText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 2,
  },
  hudTimerWarningText: {
    color: '#ef4444',
    textShadowColor: 'rgba(239, 68, 68, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  hudRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudCoinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1.2,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  hudCoinsText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
  },
  hintBanner: {
    position: 'absolute',
    top: '12%',
    left: 20,
    right: 20,
    zIndex: 10,
    alignItems: 'center',
  },
  hintBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  hintBannerText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  boardRegion: {
    height: '70%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  movesRegion: {
    height: '5%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  movesText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  ghostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  ghostText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a78bfa',
  },
  toolbarRegion: {
    height: '15%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassDock: {
    height: 72,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  dockButton: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  disabledButton: {
    opacity: 0.4,
  },
  pressedScaleSmall: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  pressedScale: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  dockButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  dockButtonText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  disabledText: {
    color: '#64748b',
  },
  dockDivider: {
    width: 1.2,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dockCostBadge: {
    position: 'absolute',
    top: -12,
    right: 4,
    backgroundColor: '#fbbf24',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  dockCostBadgeText: {
    color: '#0f172a',
    fontSize: 8,
    fontWeight: '900',
  },
  dockCostBadgeUsed: {
    backgroundColor: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassModalContent: {
    width: '88%',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#FFFFFF',
    marginBottom: 20,
    textShadowColor: 'rgba(99, 102, 241, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  settingsBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    width: '100%',
    padding: 15,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeButtonText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  crownGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  victoryTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 3,
    textShadowColor: 'rgba(251, 191, 36, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  victorySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    marginBottom: 20,
  },
  scoreBreakdownContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 24,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  breakdownLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownValue: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 10,
  },
  victoryCoinsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  victoryCoinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  victoryCoinsVal: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '900',
  },
  victoryScoreVal: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  victoryBtn: {
    backgroundColor: '#10b981',
    width: '100%',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 14,
  },
  victoryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  victoryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  victorySubButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  victorySubButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '800',
  },
  sessionSummaryContent: {
    width: '90%',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sessionSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionSummaryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 2,
  },
  sessionSummarySub: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 20,
  },
  sessionStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  sessionStatCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    alignItems: 'center',
  },
  sessionStatVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f8fafc',
    marginVertical: 4,
  },
  sessionStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  sessionActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  sessionExitBtn: {
    flex: 1.2,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginRight: 8,
  },
  sessionExitBtnText: {
    color: '#ef4444',
    fontWeight: '900',
    fontSize: 13,
  },
  sessionResumeBtn: {
    flex: 2,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  sessionResumeBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  adOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  adBox: {
    backgroundColor: '#1e293b',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  adTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  adDesc: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
});
