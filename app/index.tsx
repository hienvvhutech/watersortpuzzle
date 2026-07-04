import React, { useState, useEffect } from 'react';
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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '../src/presentation/store/gameStore';
import { useSettingsStore } from '../src/presentation/store/settingsStore';
import { useProfileStore } from '../src/presentation/store/profileStore';
import { THEMES } from '../src/presentation/themes';
import { useAudio } from '../src/presentation/hooks/useAudio';
import { useHaptics } from '../src/presentation/hooks/useHaptics';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { GameBackground } from '../src/presentation/components/GameBackground';
import { useTranslation } from '../src/shared/i18n';
import { LeaderboardService } from '../src/services/LeaderboardService';
import { services, IBattleService } from '../src/shared/IServiceRegistry';
import { LeaderboardEntry, LeaderboardGroup } from '../src/domain/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const audio = useAudio();
  const haptics = useHaptics();
  const { t, language, setLanguage } = useTranslation();

  // Zustand stores
  const { coins, stats, resetGame, startLevel } = useGameStore();
  const { seasonPassStars, levelProgress } = useProfileStore();
  const {
    soundEnabled,
    musicEnabled,
    vibrationEnabled,
    setSoundEnabled,
    setMusicEnabled,
    setVibrationEnabled,
  } = useSettingsStore();

  // Calculate dynamic level progression to avoid locking replayed levels
  const completedLevels = Object.keys(levelProgress).map(Number);
  const highestCompletedLevel = completedLevels.length > 0 ? Math.max(...completedLevels) : 0;
  const campaignProgressLevel = highestCompletedLevel + 1;

  // Modals state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [levelsVisible, setLevelsVisible] = useState(false);

  // Leaderboard states
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'global' | 'friends'>('global');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'level' | 'score' | 'coins' | 'bestTime'>('score');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [groups, setGroups] = useState<LeaderboardGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  
  // Create Group states
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newFriendNames, setNewFriendNames] = useState('');

  // Battle Hub states
  const [battleHubVisible, setBattleHubVisible] = useState(false);
  const [battleStep, setBattleStep] = useState<'menu' | 'botDiff' | 'roomWait' | 'roomJoin'>('menu');
  const [battleRoomCode, setBattleRoomCode] = useState('');
  const [enteredRoomCode, setEnteredRoomCode] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Load Leaderboard data on change
  useEffect(() => {
    if (leaderboardVisible) {
      loadLeaderboardData();
      if (leaderboardTab === 'friends') {
        loadGroups();
      }
    }
  }, [leaderboardVisible, leaderboardTab, leaderboardSortBy, selectedGroupId]);

  // Simulate opponent joining the host room after 3.5 seconds
  useEffect(() => {
    if (battleHubVisible && battleStep === 'roomWait') {
      const timer = setTimeout(() => {
        haptics.success();
        audio.playSound('reward');
        Alert.alert(
          t('battle.opponentJoined'),
          'Opponent Speedy_Sorter (Bot) joined the lobby!',
          [
            {
              text: 'START DUEL',
              onPress: () => {
                setBattleHubVisible(false);
                setBattleStep('menu');
                router.replace(`/battle?mode=room&roomCode=${battleRoomCode}`);
              },
            },
          ]
        );
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [battleHubVisible, battleStep]);

  const loadLeaderboardData = async () => {
    try {
      if (leaderboardTab === 'global') {
        const data = await LeaderboardService.getGlobal(leaderboardSortBy, 15);
        setLeaderboardData(data);
      } else {
        if (selectedGroupId) {
          const data = await LeaderboardService.getFriends(selectedGroupId, leaderboardSortBy, 10);
          setLeaderboardData(data);
        } else {
          setLeaderboardData([]);
        }
      }
    } catch (e) {
      console.warn('Failed to load leaderboard data', e);
    }
  };

  const loadGroups = async () => {
    try {
      const list = await LeaderboardService.getGroups();
      setGroups(list);
      if (list.length > 0 && !selectedGroupId) {
        setSelectedGroupId(list[0].id);
      }
    } catch (e) {
      console.warn('Failed to load groups', e);
    }
  };

  const handleCreateGroupSubmit = async () => {
    if (!newGroupName.trim()) {
      Alert.alert(t('settings.resetClearedTitle'), 'Please enter a group name');
      return;
    }
    const friends = newFriendNames
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    if (friends.length === 0) {
      Alert.alert(t('settings.resetClearedTitle'), 'Please enter at least one friend name');
      return;
    }

    try {
      const newGroup = await LeaderboardService.createGroup(newGroupName, friends);
      setNewGroupName('');
      setNewFriendNames('');
      setCreateGroupVisible(false);

      // Refresh groups list and select new group
      const list = await LeaderboardService.getGroups();
      setGroups(list);
      setSelectedGroupId(newGroup.id);
      setLeaderboardTab('friends');
    } catch (e) {
      console.warn('Failed to create group', e);
    }
  };

  const handleCreateRoom = async () => {
    audio.playSound('click');
    haptics.selection();
    try {
      const battleService = services.get<IBattleService>('Battle');
      const session = await battleService.createRoom();
      setBattleRoomCode(session.roomId);
      setBattleStep('roomWait');
    } catch (e) {
      console.warn('Failed to create battle room', e);
    }
  };

  const handleJoinRoomSubmit = async () => {
    if (!enteredRoomCode.trim()) return;
    audio.playSound('click');
    haptics.selection();
    setConnecting(true);

    try {
      const battleService = services.get<IBattleService>('Battle');
      await battleService.joinRoom(enteredRoomCode);
      setConnecting(false);
      setBattleHubVisible(false);
      setBattleStep('menu');
      setEnteredRoomCode('');
      router.replace(`/battle?mode=room&roomCode=${enteredRoomCode.toUpperCase()}`);
    } catch (e) {
      setConnecting(false);
      Alert.alert('Connection Failed', 'Could not connect to room. Please check the code.');
    }
  };

  const handlePlay = () => {
    audio.playSound('click');
    haptics.selection();
    startLevel(campaignProgressLevel);
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
      t('settings.resetAlertTitle'),
      t('settings.resetAlertConfirm'),
      [
        { text: t('settings.resetAlertCancel'), style: 'cancel' },
        {
          text: t('settings.resetAlertSuccess'),
          style: 'destructive',
          onPress: () => {
            resetGame();
            Alert.alert(t('settings.resetClearedTitle'), t('settings.resetClearedDesc'));
          },
        },
      ]
    );
  };

  const renderLevels = () => {
    const list = [];
    for (let i = 1; i <= campaignProgressLevel; i++) {
      list.push(
        <Pressable
          key={`lvl-select-${i}`}
          style={({ pressed }) => [
            styles.levelCard,
            pressed && styles.pressedScaleSmall,
          ]}
          onPress={() => handleLevelSelect(i)}
        >
          <Text style={styles.levelCardText}>{t('levels.card', { level: i })}</Text>
        </Pressable>
      );
    }
    return list;
  };

  const renderRankBadge = (rank: number) => {
    if (rank === 1) return <FontAwesome5 name="medal" size={16} color="#fbbf24" />;
    if (rank === 2) return <FontAwesome5 name="medal" size={16} color="#cbd5e1" />;
    if (rank === 3) return <FontAwesome5 name="medal" size={16} color="#b45309" />;
    return <Text style={styles.rankBadgeText}>{rank}</Text>;
  };

  const renderValueText = (entry: LeaderboardEntry) => {
    if (leaderboardSortBy === 'level') return `${entry.level} Lvl`;
    if (leaderboardSortBy === 'coins') return `🪙 ${entry.coins}`;
    if (leaderboardSortBy === 'bestTime') return `${entry.bestTime}s`;
    return `${entry.score} pts`;
  };

  return (
    <View style={styles.container}>
      {/* Premium Ambient Background */}
      <GameBackground />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Title Container with Ambient Neon Glow */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>{t('home.title')}</Text>
          <Text style={styles.subtitleText}>{t('home.subtitle')}</Text>
        </View>

        {/* Level Info & Play Button */}
        <View style={styles.centerContainer}>
          <View style={styles.badgeContainer}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeText}>{t('home.level', { level: campaignProgressLevel })}</Text>
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
              {campaignProgressLevel === 1 ? t('home.playNow') : t('home.continue')}
            </Text>
          </Pressable>
        </View>

        {/* Season Pass & Locked/Unlocked Friend Battle Launcher */}
        <View style={styles.metaContainer}>
          {/* Season Pass Progress Card */}
          <View style={styles.seasonPassCard}>
            <View style={styles.seasonPassHeader}>
              <Ionicons name="gift-sharp" size={16} color="#c084fc" style={{ marginRight: 6 }} />
              <Text style={styles.seasonPassTitle}>{t('home.seasonPass')}</Text>
              <Text style={styles.seasonPassStarsCount}>{t('home.seasonPassProgress', { stars: seasonPassStars })}</Text>
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
              {t('home.seasonPassDesc')}
            </Text>
          </View>

          {/* Friend Battle Card (Level 20 locked) */}
          <Pressable
            style={({ pressed }) => [
              styles.friendBattleCard,
              highestCompletedLevel < 20 && styles.friendBattleLocked,
              pressed && styles.pressedScaleSmall,
            ]}
            onPress={() => {
              if (highestCompletedLevel < 20) {
                audio.playSound('error');
                haptics.error();
                Alert.alert(
                  t('battle.locked'),
                  t('battle.lockedDesc'),
                  [{ text: t('settings.close') }]
                );
              } else {
                audio.playSound('click');
                haptics.selection();
                setBattleHubVisible(true);
                setBattleStep('menu');
              }
            }}
          >
            <View style={styles.friendBattleContent}>
              <View style={styles.friendBattleLeft}>
                <Ionicons 
                  name={highestCompletedLevel < 20 ? 'lock-closed' : 'people-sharp'} 
                  size={18} 
                  color={highestCompletedLevel < 20 ? '#64748b' : '#fbbf24'} 
                  style={{ marginRight: 8 }} 
                />
                <Text style={[
                  styles.friendBattleText, 
                  highestCompletedLevel < 20 && { color: '#64748b' }
                ]}>
                  {t('home.friendBattles')}
                </Text>
              </View>
              {highestCompletedLevel < 20 ? (
                <Text style={styles.friendBattleLockText}>{t('home.requiredLevel')}</Text>
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
              <Ionicons name="map" size={14} color="#e2e8f0" style={{ marginRight: 4 }} />
              <Text style={styles.menuButtonText}>{t('home.levels')}</Text>
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
              setLeaderboardVisible(true);
            }}
          >
            <View style={styles.menuButtonContent}>
              <Ionicons name="trophy" size={14} color="#e2e8f0" style={{ marginRight: 4 }} />
              <Text style={styles.menuButtonText}>{t('home.leaderboard')}</Text>
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
              <Ionicons name="bar-chart" size={14} color="#e2e8f0" style={{ marginRight: 4 }} />
              <Text style={styles.menuButtonText}>{t('home.stats')}</Text>
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
              <Ionicons name="settings" size={14} color="#e2e8f0" style={{ marginRight: 4 }} />
              <Text style={styles.menuButtonText}>{t('home.settings')}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* MODAL 1: SETTINGS */}
      <Modal visible={settingsVisible} animationType="slide" transparent>
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

              {/* Language Selector Row */}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('settings.language')}</Text>
                <View style={styles.languageToggleGroup}>
                  <Pressable
                    style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
                    onPress={() => {
                      audio.playSound('click');
                      haptics.selection();
                      setLanguage('en');
                    }}
                  >
                    <Text style={[styles.languageOptionText, language === 'en' && styles.languageOptionTextActive]}>EN</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.languageOption, language === 'vi' && styles.languageOptionActive]}
                    onPress={() => {
                      audio.playSound('click');
                      haptics.selection();
                      setLanguage('vi');
                    }}
                  >
                    <Text style={[styles.languageOptionText, language === 'vi' && styles.languageOptionTextActive]}>VI</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.resetButton,
                pressed && styles.pressedScaleSmall,
              ]}
              onPress={confirmReset}
            >
              <Text style={styles.resetButtonText}>{t('settings.reset')}</Text>
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
              <Text style={styles.closeButtonText}>{t('settings.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: STATISTICS */}
      <Modal visible={statsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalContent}>
            <Text style={styles.modalTitle}>{t('stats.title')}</Text>

            <ScrollView style={styles.statsScroll} contentContainerStyle={styles.statsScrollContent}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.gamesPlayed')}</Text>
                <Text style={styles.statValue}>{stats.gamesPlayed}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.wins')}</Text>
                <Text style={styles.statValue}>{stats.wins}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.winRate')}</Text>
                <Text style={styles.statValue}>
                  {stats.gamesPlayed > 0 ? `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%` : '0%'}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.totalMoves')}</Text>
                <Text style={styles.statValue}>{stats.moves}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.hintUsed')}</Text>
                <Text style={styles.statValue}>{stats.hintUsed}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.undoUsed')}</Text>
                <Text style={styles.statValue}>{stats.undoUsed}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.coinsEarned')}</Text>
                <Text style={styles.statValue}>🪙 {stats.coinsEarned}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('stats.longestStreak')}</Text>
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
              <Text style={styles.closeButtonText}>{t('stats.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: LEVELS */}
      <Modal visible={levelsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.glassModalContent, { height: '65%' }]}>
            <Text style={styles.modalTitle}>{t('levels.title')}</Text>

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
              <Text style={styles.closeButtonText}>{t('levels.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: LEADERBOARDS */}
      <Modal visible={leaderboardVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.glassModalContent, { height: '78%', width: '92%' }]}>
            <Text style={styles.modalTitle}>{t('leaderboard.title')}</Text>

            {/* Tabs Header */}
            <View style={styles.leaderboardTabs}>
              <Pressable
                style={[styles.leaderboardTab, leaderboardTab === 'global' && styles.leaderboardTabActive]}
                onPress={() => {
                  audio.playSound('click');
                  haptics.selection();
                  setLeaderboardTab('global');
                }}
              >
                <Text style={[styles.leaderboardTabText, leaderboardTab === 'global' && styles.leaderboardTabTextActive]}>
                  {t('leaderboard.globalTab')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.leaderboardTab, leaderboardTab === 'friends' && styles.leaderboardTabActive]}
                onPress={() => {
                  audio.playSound('click');
                  haptics.selection();
                  setLeaderboardTab('friends');
                }}
              >
                <Text style={[styles.leaderboardTabText, leaderboardTab === 'friends' && styles.leaderboardTabTextActive]}>
                  {t('leaderboard.friendsTab')}
                </Text>
              </Pressable>
            </View>

            {/* Category Filter Scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
              <Pressable
                style={[styles.filterBadge, leaderboardSortBy === 'score' && styles.filterBadgeActive]}
                onPress={() => setLeaderboardSortBy('score')}
              >
                <Text style={[styles.filterBadgeText, leaderboardSortBy === 'score' && styles.filterBadgeTextActive]}>
                  {t('leaderboard.scoreFilter')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterBadge, leaderboardSortBy === 'level' && styles.filterBadgeActive]}
                onPress={() => setLeaderboardSortBy('level')}
              >
                <Text style={[styles.filterBadgeText, leaderboardSortBy === 'level' && styles.filterBadgeTextActive]}>
                  {t('leaderboard.levelFilter')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterBadge, leaderboardSortBy === 'coins' && styles.filterBadgeActive]}
                onPress={() => setLeaderboardSortBy('coins')}
              >
                <Text style={[styles.filterBadgeText, leaderboardSortBy === 'coins' && styles.filterBadgeTextActive]}>
                  {t('leaderboard.coinsFilter')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.filterBadge, leaderboardSortBy === 'bestTime' && styles.filterBadgeActive]}
                onPress={() => setLeaderboardSortBy('bestTime')}
              >
                <Text style={[styles.filterBadgeText, leaderboardSortBy === 'bestTime' && styles.filterBadgeTextActive]}>
                  {t('leaderboard.bestTimeFilter')}
                </Text>
              </Pressable>
            </ScrollView>

            {/* Friends Group Switcher */}
            {leaderboardTab === 'friends' && (
              <View style={styles.friendsGroupSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll} contentContainerStyle={styles.groupScrollContent}>
                  {groups.map((g) => (
                    <Pressable
                      key={g.id}
                      style={[styles.groupBadge, selectedGroupId === g.id && styles.groupBadgeActive]}
                      onPress={() => setSelectedGroupId(g.id)}
                    >
                      <Text style={[styles.groupBadgeText, selectedGroupId === g.id && styles.groupBadgeTextActive]}>
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    style={styles.groupAddButton}
                    onPress={() => {
                      audio.playSound('click');
                      haptics.selection();
                      setCreateGroupVisible(true);
                    }}
                  >
                    <Ionicons name="add" size={14} color="#e2e8f0" />
                  </Pressable>
                </ScrollView>
              </View>
            )}

            {/* Ranking Headers */}
            <View style={styles.rankTableHeader}>
              <Text style={[styles.rankHeaderCol, { width: '15%' }]}>{t('leaderboard.rank')}</Text>
              <Text style={[styles.rankHeaderCol, { width: '55%', textAlign: 'left', paddingLeft: 10 }]}>{t('leaderboard.player')}</Text>
              <Text style={[styles.rankHeaderCol, { width: '30%', textAlign: 'right' }]}>{t('leaderboard.value')}</Text>
            </View>

            {/* Rankings List */}
            <ScrollView style={styles.rankListScroll} contentContainerStyle={styles.rankListContent}>
              {leaderboardTab === 'friends' && groups.length === 0 ? (
                <View style={styles.emptyView}>
                  <Ionicons name="people-outline" size={40} color="#64748b" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyText}>{t('leaderboard.noGroups')}</Text>
                  <Pressable
                    style={styles.createGroupActionBtn}
                    onPress={() => setCreateGroupVisible(true)}
                  >
                    <Text style={styles.createGroupActionBtnText}>{t('leaderboard.createGroup')}</Text>
                  </Pressable>
                </View>
              ) : (
                leaderboardData.map((item) => (
                  <View
                    key={item.userId}
                    style={[
                      styles.rankRow,
                      item.userId === 'player_self' && styles.rankRowSelf,
                    ]}
                  >
                    <View style={styles.rankColRank}>
                      {renderRankBadge(item.rank || 0)}
                    </View>
                    <Text
                      style={[
                        styles.rankColName,
                        item.userId === 'player_self' && styles.rankColNameSelf,
                      ]}
                      numberOfLines={1}
                    >
                      {item.userId === 'player_self' ? `${item.username} (You)` : item.username}
                    </Text>
                    <Text
                      style={[
                        styles.rankColValue,
                        item.userId === 'player_self' && styles.rankColValueSelf,
                      ]}
                    >
                      {renderValueText(item)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressedScaleSmall,
                { marginTop: 12 }
              ]}
              onPress={() => {
                audio.playSound('click');
                haptics.selection();
                setLeaderboardVisible(false);
              }}
            >
              <Text style={styles.closeButtonText}>{t('leaderboard.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* DIALOG: CREATE GROUP OVERLAY */}
      <Modal visible={createGroupVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>{t('leaderboard.createGroup')}</Text>

            <TextInput
              style={styles.dialogInput}
              placeholder={t('leaderboard.groupNamePlaceholder')}
              placeholderTextColor="#64748b"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <TextInput
              style={[styles.dialogInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              placeholder={t('leaderboard.friendsPlaceholder')}
              placeholderTextColor="#64748b"
              multiline
              value={newFriendNames}
              onChangeText={setNewFriendNames}
            />

            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancelBtn}
                onPress={() => setCreateGroupVisible(false)}
              >
                <Text style={styles.dialogCancelBtnText}>{t('leaderboard.cancel')}</Text>
              </Pressable>

              <Pressable
                style={styles.dialogCreateBtn}
                onPress={handleCreateGroupSubmit}
              >
                <Text style={styles.dialogCreateBtnText}>{t('leaderboard.create')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 5: BATTLE HUB */}
      <Modal visible={battleHubVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.glassModalContent}>
            <Text style={styles.modalTitle}>{t('battle.title')}</Text>
            <Text style={styles.battleHubDesc}>{t('battle.desc')}</Text>

            {battleStep === 'menu' && (
              <View style={styles.battleHubOptions}>
                <Pressable
                  style={styles.battleHubBtn}
                  onPress={() => setBattleStep('botDiff')}
                >
                  <Text style={styles.battleHubBtnText}>{t('battle.duelBot')}</Text>
                </Pressable>

                <Pressable
                  style={styles.battleHubBtn}
                  onPress={handleCreateRoom}
                >
                  <Text style={styles.battleHubBtnText}>{t('battle.createRoom')}</Text>
                </Pressable>

                <Pressable
                  style={styles.battleHubBtn}
                  onPress={() => setBattleStep('roomJoin')}
                >
                  <Text style={styles.battleHubBtnText}>{t('battle.joinRoom')}</Text>
                </Pressable>
              </View>
            )}

            {battleStep === 'botDiff' && (
              <View style={styles.battleHubOptions}>
                <Pressable
                  style={[styles.battleHubBtn, { borderColor: '#10b981' }]}
                  onPress={() => {
                    setBattleHubVisible(false);
                    router.push('/battle?mode=bot&difficulty=easy');
                  }}
                >
                  <Text style={[styles.battleHubBtnText, { color: '#10b981' }]}>{t('battle.botDiffEasy')}</Text>
                </Pressable>

                <Pressable
                  style={[styles.battleHubBtn, { borderColor: '#fbbf24' }]}
                  onPress={() => {
                    setBattleHubVisible(false);
                    router.push('/battle?mode=bot&difficulty=medium');
                  }}
                >
                  <Text style={[styles.battleHubBtnText, { color: '#fbbf24' }]}>{t('battle.botDiffMedium')}</Text>
                </Pressable>

                <Pressable
                  style={[styles.battleHubBtn, { borderColor: '#ef4444' }]}
                  onPress={() => {
                    setBattleHubVisible(false);
                    router.push('/battle?mode=bot&difficulty=hard');
                  }}
                >
                  <Text style={[styles.battleHubBtnText, { color: '#ef4444' }]}>{t('battle.botDiffHard')}</Text>
                </Pressable>
              </View>
            )}

            {battleStep === 'roomWait' && (
              <View style={styles.battleHubOptions}>
                <Text style={styles.roomCodeLabel}>{t('battle.roomCode')}</Text>
                <Text style={styles.roomCodeValue}>{battleRoomCode}</Text>
                
                <ActivityIndicator size="small" color="#fbbf24" style={{ marginVertical: 14 }} />
                <Text style={styles.waitingText}>{t('battle.waitingOpponent')}</Text>

                <Pressable
                  style={[styles.battleHubBtn, { marginTop: 20 }]}
                  onPress={() => {
                    setBattleHubVisible(false);
                    router.push(`/battle?mode=bot&difficulty=medium`);
                  }}
                >
                  <Text style={styles.battleHubBtnText}>{t('battle.startWithBot')}</Text>
                </Pressable>
              </View>
            )}

            {battleStep === 'roomJoin' && (
              <View style={styles.battleHubOptions}>
                {connecting ? (
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <ActivityIndicator size="large" color="#10b981" style={{ marginBottom: 12 }} />
                    <Text style={styles.waitingText}>{t('battle.connecting')}</Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={styles.dialogInput}
                      placeholder={t('battle.enterRoomCode')}
                      placeholderTextColor="#64748b"
                      autoCapitalize="characters"
                      value={enteredRoomCode}
                      onChangeText={setEnteredRoomCode}
                    />

                    <Pressable
                      style={[styles.battleHubBtn, { backgroundColor: '#10b981', borderColor: '#10b981', marginTop: 10 }]}
                      onPress={handleJoinRoomSubmit}
                    >
                      <Text style={[styles.battleHubBtnText, { color: '#ffffff' }]}>{t('battle.join')}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressedScaleSmall,
                { marginTop: 16 }
              ]}
              onPress={() => {
                audio.playSound('click');
                haptics.selection();
                if (battleStep !== 'menu') {
                  setBattleStep('menu');
                } else {
                  setBattleHubVisible(false);
                }
              }}
            >
              <Text style={styles.closeButtonText}>
                {battleStep === 'menu' ? t('battle.close') : t('battle.cancel')}
              </Text>
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
    backgroundColor: '#0b0f19', // Standard dark theme start color
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
    width: '94%',
    justifyContent: 'space-between',
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 11,
    fontWeight: '800',
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
    padding: 20,
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
    marginBottom: 16,
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
  languageToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 3,
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9,
  },
  languageOptionActive: {
    backgroundColor: '#10b981',
  },
  languageOptionText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  languageOptionTextActive: {
    color: '#ffffff',
  },
  // Leaderboards Styles
  leaderboardTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 4,
    width: '100%',
    marginBottom: 12,
  },
  leaderboardTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  leaderboardTabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  leaderboardTabText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 14,
  },
  leaderboardTabTextActive: {
    color: '#ffffff',
  },
  filterScroll: {
    width: '100%',
    maxHeight: 40,
    marginBottom: 10,
  },
  filterScrollContent: {
    alignItems: 'center',
  },
  filterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterBadgeActive: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  filterBadgeText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 11,
  },
  filterBadgeTextActive: {
    color: '#0f172a',
  },
  friendsGroupSection: {
    width: '100%',
    maxHeight: 36,
    marginBottom: 10,
  },
  groupScroll: {
    width: '100%',
  },
  groupScrollContent: {
    alignItems: 'center',
  },
  groupBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 10,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.1)',
  },
  groupBadgeActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  groupBadgeText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 10,
  },
  groupBadgeTextActive: {
    color: '#ffffff',
  },
  groupAddButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  rankTableHeader: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  rankTableHeaderCol: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rankHeaderCol: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  rankListScroll: {
    flex: 1,
    width: '100%',
  },
  rankListContent: {
    paddingVertical: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  rankRowSelf: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    borderBottomWidth: 0,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  rankColRank: {
    width: '15%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 12,
  },
  rankColName: {
    width: '55%',
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 13,
    paddingLeft: 10,
  },
  rankColNameSelf: {
    color: '#34d399',
    fontWeight: '800',
  },
  rankColValue: {
    width: '30%',
    color: '#e2e8f0',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'right',
  },
  rankColValueSelf: {
    color: '#34d399',
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  createGroupActionBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  createGroupActionBtnText: {
    color: '#818cf8',
    fontWeight: '800',
    fontSize: 12,
  },
  // Dialog (Create Group Overlay) Styles
  dialogContent: {
    width: '84%',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 16,
  },
  dialogInput: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: 12,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dialogCancelBtnText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 13,
  },
  dialogCreateBtn: {
    flex: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 6,
    backgroundColor: '#10b981',
    borderRadius: 14,
  },
  dialogCreateBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  // Battle Hub Styles
  battleHubDesc: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: -8,
  },
  battleHubOptions: {
    width: '100%',
    alignItems: 'center',
  },
  battleHubBtn: {
    width: '100%',
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    alignItems: 'center',
    marginVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  battleHubBtnText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roomCodeLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  roomCodeValue: {
    color: '#fbbf24',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    marginVertical: 10,
  },
  waitingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
});
