import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import { useGameStore } from '../src/presentation/store/gameStore';
import { useSettingsStore } from '../src/presentation/store/settingsStore';
import { useProfileStore } from '../src/presentation/store/profileStore';
import { THEMES } from '../src/presentation/themes';
import { useAudio } from '../src/presentation/hooks/useAudio';
import { useHaptics } from '../src/presentation/hooks/useHaptics';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { GameBackground } from '../src/presentation/components/GameBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const audio = useAudio();
  const haptics = useHaptics();

  // Zustand stores
  const { currentLevel, coins, stats, resetGame, startLevel } = useGameStore();
  const { seasonPassStars } = useProfileStore();
  const {
    soundEnabled,
    musicEnabled,
    vibrationEnabled,
    setSoundEnabled,
    setMusicEnabled,
    setVibrationEnabled,
  } = useSettingsStore();

  const theme = THEMES.dark; // Main theme for home menu

  // Modals state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [levelsVisible, setLevelsVisible] = useState(false);

  const handlePlay = () => {
    audio.playSound('click');
    haptics.selection();
    startLevel(currentLevel);
    router.push('/game');
  };

  const handleLevelSelect = (levelId: number) => {
    audio.playSound('click');
    haptics.selection();
    startLevel(levelId);
    setLevelsVisible(false);
    router.push('/game');
  };

  const confirmReset = () => {
    audio.playSound('click');
    haptics.selection();
    Alert.alert(
      'Reset Progress',
      'Are you sure you want to delete all coins, completed levels, and game statistics? This action is permanent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: () => {
            resetGame();
            Alert.alert('Cleared', 'All game data has been successfully reset.');
          },
        },
      ]
    );
  };

  const renderLevels = () => {
    const list = [];
    for (let i = 1; i <= currentLevel; i++) {
      list.push(
        <Pressable
          key={`lvl-select-${i}`}
          style={({ pressed }) => [
            styles.levelCard,
            pressed && styles.pressedScaleSmall,
          ]}
          onPress={() => handleLevelSelect(i)}
        >
          <Text style={styles.levelCardText}>Lvl {i}</Text>
        </Pressable>
      );
    }
    return list;
  };

  return (
    <View style={styles.container}>
      {/* Premium Ambient Background */}
      <GameBackground />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Title Container with Ambient Neon Glow */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>WATER SORT</Text>
          <Text style={styles.subtitleText}>PUZZLE CHALLENGE</Text>
        </View>

        {/* Level Info & Play Button */}
        <View style={styles.centerContainer}>
          <View style={styles.badgeContainer}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>LEVEL {currentLevel}</Text>
            </View>
            <View style={styles.coinBadge}>
              <FontAwesome5 name="coins" size={14} color="#fbbf24" style={{ marginRight: 6 }} />
              <Text style={styles.coinBadgeText}>{coins}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.playButton,
              pressed && styles.pressedScale,
            ]}
            onPress={handlePlay}
          >
            <Text style={styles.playButtonText}>
              {currentLevel === 1 ? 'PLAY NOW' : 'CONTINUE'}
            </Text>
          </Pressable>
        </View>

        {/* Season Pass & Locked/Unlocked Friend Battle Launcher */}
        <View style={styles.metaContainer}>
          {/* Season Pass Progress Card */}
          <View style={styles.seasonPassCard}>
            <View style={styles.seasonPassHeader}>
              <Ionicons name="gift-sharp" size={16} color="#c084fc" style={{ marginRight: 6 }} />
              <Text style={styles.seasonPassTitle}>SUMMER SEASON PASS</Text>
              <Text style={styles.seasonPassStarsCount}>{seasonPassStars}/30 ⭐</Text>
            </View>
            <View style={styles.seasonPassProgressBarBg}>
              <View 
                style={[
                  styles.seasonPassProgressBarFill, 
                  { width: `${Math.min(100, (seasonPassStars / 30) * 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.seasonPassDesc}>
              Complete levels to earn Stars! Reach 30 Stars to unlock +200 Coins!
            </Text>
          </View>

          {/* Friend Battle Card (Level 20 locked) */}
          <Pressable
            style={({ pressed }) => [
              styles.friendBattleCard,
              currentLevel <= 20 && styles.friendBattleLocked,
              pressed && styles.pressedScaleSmall,
            ]}
            onPress={() => {
              if (currentLevel <= 20) {
                audio.playSound('error');
                haptics.error();
                Alert.alert(
                  'Locked 🔒',
                  'Friend Battles unlock at Level 20! Complete more campaign levels to access multiplayer duels.',
                  [{ text: 'OK' }]
                );
              } else {
                audio.playSound('click');
                haptics.selection();
                Alert.alert(
                  'Unlocked 🔓',
                  'Friend Battles unlocked! Offline Bot duels and room creations will be active in Phase 2.7B.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <View style={styles.friendBattleContent}>
              <View style={styles.friendBattleLeft}>
                <Ionicons 
                  name={currentLevel <= 20 ? 'lock-closed' : 'people-sharp'} 
                  size={18} 
                  color={currentLevel <= 20 ? '#64748b' : '#fbbf24'} 
                  style={{ marginRight: 8 }} 
                />
                <Text style={[
                  styles.friendBattleText, 
                  currentLevel <= 20 && { color: '#64748b' }
                ]}>
                  FRIEND BATTLES
                </Text>
              </View>
              {currentLevel <= 20 ? (
                <Text style={styles.friendBattleLockText}>Level 20 Required</Text>
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#fbbf24" />
              )}
            </View>
          </Pressable>
        </View>

        {/* Navigation Buttons Row */}
        <View style={styles.buttonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.pressedScaleSmall,
            ]}
            onPress={() => {
              audio.playSound('click');
              haptics.selection();
              setLevelsVisible(true);
            }}
          >
            <View style={styles.menuButtonContent}>
              <Ionicons name="map" size={16} color="#e2e8f0" style={{ marginRight: 6 }} />
              <Text style={styles.menuButtonText}>Levels</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.pressedScaleSmall,
            ]}
            onPress={() => {
              audio.playSound('click');
              haptics.selection();
              setStatsVisible(true);
            }}
          >
            <View style={styles.menuButtonContent}>
              <Ionicons name="bar-chart" size={16} color="#e2e8f0" style={{ marginRight: 6 }} />
              <Text style={styles.menuButtonText}>Stats</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.pressedScaleSmall,
            ]}
            onPress={() => {
              audio.playSound('click');
              haptics.selection();
              setSettingsVisible(true);
            }}
          >
            <View style={styles.menuButtonContent}>
              <Ionicons name="settings" size={16} color="#e2e8f0" style={{ marginRight: 6 }} />
              <Text style={styles.menuButtonText}>Settings</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* MODAL 1: SETTINGS */}
      <Modal visible={settingsVisible} animationType="slide" transparent>
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
                styles.resetButton,
                pressed && styles.pressedScaleSmall,
              ]}
              onPress={confirmReset}
            >
              <Text style={styles.resetButtonText}>RESET DATA</Text>
            </Pressable>

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

      {/* MODAL 2: STATISTICS */}
      <Modal visible={statsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalContent}>
            <Text style={styles.modalTitle}>STATISTICS</Text>

            <ScrollView style={styles.statsScroll} contentContainerStyle={styles.statsScrollContent}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Games Played</Text>
                <Text style={styles.statValue}>{stats.gamesPlayed}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Wins</Text>
                <Text style={styles.statValue}>{stats.wins}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Win Rate</Text>
                <Text style={styles.statValue}>
                  {stats.gamesPlayed > 0 ? `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%` : '0%'}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Moves</Text>
                <Text style={styles.statValue}>{stats.moves}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Hint Used</Text>
                <Text style={styles.statValue}>{stats.hintUsed}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Undo Used</Text>
                <Text style={styles.statValue}>{stats.undoUsed}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Coins Earned</Text>
                <Text style={styles.statValue}>🪙 {stats.coinsEarned}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Longest Streak</Text>
                <Text style={styles.statValue}>{stats.longestStreak} 🔥</Text>
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressedScaleSmall,
              ]}
              onPress={() => {
                audio.playSound('click');
                haptics.selection();
                setStatsVisible(false);
              }}
            >
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: LEVELS */}
      <Modal visible={levelsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.glassModalContent, { height: '65%' }]}>
            <Text style={styles.modalTitle}>SELECT LEVEL</Text>

            <ScrollView style={styles.levelsScroll} contentContainerStyle={styles.levelsScrollContent}>
              <View style={styles.levelsGrid}>{renderLevels()}</View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressedScaleSmall,
              ]}
              onPress={() => {
                audio.playSound('click');
                haptics.selection();
                setLevelsVisible(false);
              }}
            >
              <Text style={styles.closeButtonText}>CLOSE</Text>
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
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 70,
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 45,
  },
  titleText: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
    textShadowColor: 'rgba(99, 102, 241, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 7,
    marginTop: 6,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 30,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    padding: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  infoBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 18,
    marginRight: 6,
  },
  infoBadgeText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  coinBadge: {
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  coinBadgeText: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '900',
  },
  playButton: {
    backgroundColor: '#10b981', // Emerald green
    paddingHorizontal: 60,
    paddingVertical: 20,
    borderRadius: 32,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  pressedScale: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  pressedScaleSmall: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '90%',
    justifyContent: 'space-between',
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flex: 1,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassModalContent: {
    width: SCREEN_WIDTH * 0.88,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    maxHeight: '80%',
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
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    width: '100%',
    padding: 15,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  resetButtonText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    width: '100%',
    padding: 15,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeButtonText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  statsScroll: {
    width: '100%',
    marginBottom: 10,
  },
  statsScrollContent: {
    alignItems: 'center',
  },
  statBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  statLabel: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  levelsScroll: {
    width: '100%',
    marginBottom: 10,
  },
  levelsScrollContent: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  levelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%',
  },
  levelCard: {
    width: (SCREEN_WIDTH * 0.88 - 72) / 4,
    height: (SCREEN_WIDTH * 0.88 - 72) / 4,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    borderRadius: 16,
  },
  levelCardText: {
    color: '#818cf8',
    fontWeight: '800',
    fontSize: 14,
  },
  menuButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  seasonPassCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  seasonPassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  seasonPassTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    flex: 1,
  },
  seasonPassStarsCount: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '900',
  },
  seasonPassProgressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    width: '100%',
    marginBottom: 8,
    overflow: 'hidden',
  },
  seasonPassProgressBarFill: {
    height: '100%',
    backgroundColor: '#c084fc',
    borderRadius: 4,
  },
  seasonPassDesc: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'left',
  },
  friendBattleCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  friendBattleLocked: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  friendBattleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  friendBattleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendBattleText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  friendBattleLockText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
});
