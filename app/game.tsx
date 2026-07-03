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

export default function GameScreen() {
  const router = useRouter();
  const audio = useAudio();
  const haptics = useHaptics();
  const { width: windowWidth } = useWindowDimensions();

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
  const [earnedStars, setEarnedStars] = useState(3);
  const [earnedCoins, setEarnedCoins] = useState(50);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Elapsed timer effect for Ghost Replay
  useEffect(() => {
    if (isPlaying && !isWon) {
      setElapsedTime(0);
      const interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, isWon, currentLevel]);

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

            {/* Absolute Centered Level Title */}
            <View style={styles.absoluteCenteredTitle} pointerEvents="none">
              <Text style={styles.hudLevelText}>LEVEL {currentLevel}</Text>
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
                Hint: Tube {hint.from + 1} ➔ Tube {hint.to + 1}
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
          <Text style={styles.movesText}>Moves: {history.length}</Text>
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
                  Undo {history.length > 0 ? `(${history.length})` : ''}
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
                <Text style={styles.dockButtonText}>Restart</Text>
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
                <Text style={styles.dockButtonText}>Hint</Text>
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
                <Text style={[styles.dockButtonText, hasAddedTube && styles.disabledText]}>Tube</Text>
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
            <Text style={styles.modalTitle}>SETTINGS</Text>

            <View style={styles.settingsBox}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Sound Effects</Text>
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Background Music</Text>
                <Switch
                  value={musicEnabled}
                  onValueChange={setMusicEnabled}
                  trackColor={{ false: '#334155', true: '#10b981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Haptics & Vibration</Text>
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
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL: MOCK REWARDED AD LOADING */}
      <Modal visible={adLoading} transparent animationType="fade">
        <View style={styles.adOverlay}>
          <View style={styles.adContent}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.adText}>
              Loading free {adAction === 'hint' ? 'Hint' : 'Tube'}...
            </Text>
            <Text style={styles.adSubtext}>Simulating ad playback...</Text>
          </View>
        </View>
      </Modal>

      {/* MODAL: VICTORY OVERLAY */}
      <Modal visible={victoryModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.victoryContent}>
            <Text style={styles.victoryTitle}>VICTORY!</Text>

            {/* Stars Row */}
            <View style={styles.starsRow}>
              <Ionicons
                name="star"
                size={42}
                color="#fbbf24"
                style={earnedStars < 1 && styles.emptyStar}
              />
              <Ionicons
                name="star"
                size={58}
                color="#fbbf24"
                style={[styles.centerStar, earnedStars < 2 && styles.emptyStar]}
              />
              <Ionicons
                name="star"
                size={42}
                color="#fbbf24"
                style={earnedStars < 3 && styles.emptyStar}
              />
            </View>

            <Text style={styles.victorySub}>Level {currentLevel} Completed!</Text>

            {/* Satisfying Score Breakdown */}
            {lastWinReward && (
              <View style={styles.scoreBreakdownContainer}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Base Score</Text>
                  <Text style={styles.breakdownValue}>+{lastWinReward.baseScore}</Text>
                </View>
                {lastWinReward.timeBonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Time Bonus</Text>
                    <Text style={styles.breakdownValue}>+{lastWinReward.timeBonus}</Text>
                  </View>
                )}
                {lastWinReward.perfectBonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Perfect Bonus</Text>
                    <Text style={styles.breakdownValue}>+{lastWinReward.perfectBonus}</Text>
                  </View>
                )}
                {lastWinReward.noHintBonus > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>No Hint Bonus</Text>
                    <Text style={styles.breakdownValue}>+{lastWinReward.noHintBonus}</Text>
                  </View>
                )}
                {lastWinReward.comboMultiplier > 1.0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: '#a78bfa', fontWeight: '900' }]}>
                      Perfect Win Combo
                    </Text>
                    <Text style={[styles.breakdownValue, { color: '#a78bfa', fontWeight: '900' }]}>
                      x{lastWinReward.comboMultiplier.toFixed(1)}
                    </Text>
                  </View>
                )}
                <View style={styles.breakdownDivider} />
                <View style={[styles.breakdownRow, { marginTop: 4 }]}>
                  <Text style={[styles.breakdownLabel, { fontSize: 16, color: '#f8fafc', fontWeight: '900' }]}>
                    TOTAL SCORE
                  </Text>
                  <Text style={[styles.breakdownValue, { fontSize: 18, color: '#f8fafc', fontWeight: '900' }]}>
                    {lastWinReward.totalScore}
                  </Text>
                </View>
              </View>
            )}

            {/* Decoupled Rewards Summary */}
            <View style={styles.rewardsSummaryRow}>
              <View style={styles.rewardSummaryBadge}>
                <FontAwesome5 name="coins" size={13} color="#fbbf24" style={{ marginRight: 5 }} />
                <Text style={[styles.rewardSummaryText, { color: '#fbbf24' }]}>
                  +{lastWinReward?.totalCoins || earnedCoins}
                </Text>
              </View>

              <View style={styles.rewardSummaryBadge}>
                <Ionicons name="sparkles" size={13} color="#3b82f6" style={{ marginRight: 5 }} />
                <Text style={[styles.rewardSummaryText, { color: '#60a5fa' }]}>
                  +{lastWinReward?.totalXp || 50} XP
                </Text>
              </View>

              <View style={styles.rewardSummaryBadge}>
                <Ionicons name="star" size={13} color="#a78bfa" style={{ marginRight: 5 }} />
                <Text style={[styles.rewardSummaryText, { color: '#c084fc' }]}>
                  +{lastWinReward?.starsEarned || 1} Stars
                </Text>
              </View>
            </View>

            {/* Main Next Level CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.nextLevelButton,
                pressed && styles.pressedScale,
              ]}
              onPress={handleNextLevel}
            >
              <View style={styles.nextLevelButtonContent}>
                <Text style={styles.nextLevelText}>NEXT LEVEL </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
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
                <Text style={styles.victorySubButtonText}>Home</Text>
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
                <Text style={styles.victorySubButtonText}>Replay</Text>
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
              <Text style={styles.sessionSummaryTitle}>SESSION RECAP</Text>
            </View>
            <Text style={styles.sessionSummarySub}>Here is your progress from this session:</Text>

            <View style={styles.sessionStatsGrid}>
              <View style={styles.sessionStatCard}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.sessionStatVal}>{sessionLevelsPlayed}</Text>
                <Text style={styles.sessionStatLabel}>Levels Won</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="time" size={18} color="#3b82f6" />
                <Text style={styles.sessionStatVal}>
                  {sessionLevelsPlayed > 0 ? Math.floor(sessionTotalTime / sessionLevelsPlayed) : 0}s
                </Text>
                <Text style={styles.sessionStatLabel}>Avg Time</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="ribbon" size={18} color="#fbbf24" />
                <Text style={styles.sessionStatVal}>{sessionGoldCrowns}</Text>
                <Text style={styles.sessionStatLabel}>Gold Crowns</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <FontAwesome5 name="coins" size={16} color="#fbbf24" />
                <Text style={styles.sessionStatVal}>+{sessionCoinsEarned}</Text>
                <Text style={styles.sessionStatLabel}>Coins Earned</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="sparkles" size={18} color="#60a5fa" />
                <Text style={styles.sessionStatVal}>+{sessionXpEarned}</Text>
                <Text style={styles.sessionStatLabel}>XP Gained</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="star" size={18} color="#c084fc" />
                <Text style={styles.sessionStatVal}>+{sessionStarsEarned}</Text>
                <Text style={styles.sessionStatLabel}>Season Stars</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="flash" size={18} color="#f43f5e" />
                <Text style={styles.sessionStatVal}>{sessionNewRecords}</Text>
                <Text style={styles.sessionStatLabel}>New Records</Text>
              </View>

              <View style={styles.sessionStatCard}>
                <Ionicons name="medal" size={18} color="#10b981" />
                <Text style={styles.sessionStatVal}>{sessionPerfectWins}</Text>
                <Text style={styles.sessionStatLabel}>Perfect Plays</Text>
              </View>
            </View>

            <View style={styles.sessionActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.sessionExitButton,
                  pressed && styles.pressedScale,
                ]}
                onPress={handleExitToHome}
              >
                <Text style={styles.sessionExitButtonText}>EXIT TO MENU</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.sessionResumeButton,
                  pressed && styles.pressedScaleSmall,
                ]}
                onPress={() => {
                  audio.playSound('click');
                  haptics.selection();
                  setSessionSummaryVisible(false);
                }}
              >
                <Text style={styles.sessionResumeButtonText}>KEEP PLAYING</Text>
              </Pressable>
            </View>
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
  absoluteCenteredTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  hudIconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hudLevelText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(99, 102, 241, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  hudRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudCoinsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hudCoinsText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
  },
  hintBanner: {
    position: 'absolute',
    top: '11%',
    alignSelf: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 20,
  },
  hintBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBannerText: {
    color: '#fbbf24',
    fontWeight: '800',
    fontSize: 14,
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
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  toolbarRegion: {
    height: '15%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassDock: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  dockButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  dockButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  dockButtonText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '800',
  },
  disabledText: {
    color: '#64748b',
  },
  disabledButton: {
    opacity: 0.35,
  },
  dockDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dockCostBadge: {
    position: 'absolute',
    top: -16,
    right: -10,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
    borderWidth: 0.8,
    borderColor: '#d97706',
  },
  dockCostBadgeUsed: {
    backgroundColor: '#475569',
    borderColor: '#334155',
  },
  dockCostBadgeText: {
    color: '#1e1b4b',
    fontSize: 7,
    fontWeight: '900',
  },
  pressedScale: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  pressedScaleSmall: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  adOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adContent: {
    backgroundColor: '#0f172a',
    padding: 32,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  adText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 22,
  },
  adSubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassModalContent: {
    width: 320,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 30,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 24,
    textShadowColor: 'rgba(99, 102, 241, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  settingsBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 28,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingLabel: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.5,
  },
  victoryContent: {
    width: 330,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  victoryTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#f43f5e',
    letterSpacing: 4,
    marginBottom: 20,
    textShadowColor: 'rgba(244, 63, 94, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  emptyStar: {
    opacity: 0.2,
  },
  centerStar: {
    marginHorizontal: 14,
    top: -8,
  },
  victorySub: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  victoryCoinsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  victoryCoins: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fbbf24',
  },
  nextLevelButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextLevelText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1.5,
  },
  nextLevelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  victoryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
  },
  victorySubButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 12,
  },
  victorySubButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '800',
  },
  // Ghost Replay styles
  ghostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 12,
  },
  ghostText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Score Breakdown styles
  scoreBreakdownContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  breakdownLabel: {
    color: '#94a3b8',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 6,
    width: '100%',
  },
  // Decoupled Rewards styles
  rewardsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  rewardSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rewardSummaryText: {
    fontSize: 13,
    fontWeight: '900',
  },
  // Session Summary Modal styles
  sessionSummaryContent: {
    width: 340,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
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
    textShadowColor: 'rgba(251, 191, 36, 0.35)',
    textShadowRadius: 8,
  },
  sessionSummarySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    marginVertical: 5,
  },
  sessionStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
    marginVertical: 3,
  },
  sessionStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sessionActions: {
    width: '100%',
  },
  sessionExitButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sessionExitButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  sessionResumeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 18,
    width: '100%',
    alignItems: 'center',
  },
  sessionResumeButtonText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
