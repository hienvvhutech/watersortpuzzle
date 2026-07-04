import React, { useState, useEffect, useRef } from 'react';
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
  AppState,
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
import { ProfileService } from '../src/services/ProfileService';
import { SocialService } from '../src/services/SocialService';
import { services, IBattleService } from '../src/shared/IServiceRegistry';
import { LeaderboardEntry, LeaderboardGroup, FriendProfile, FriendRequest, BattleInvite } from '../src/domain/types';
import { getAvatarEmoji, AVATARS } from '../src/shared/avatars';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const audio = useAudio();
  const haptics = useHaptics();
  const { t, language, setLanguage } = useTranslation();

  // Zustand stores
  const { coins, stats, resetGame, startLevel } = useGameStore();
  const {
    seasonPassStars,
    levelProgress,
    playerId,
    displayName,
    avatarId,
    country,
    isProfileCreated,
    updateProfile,
  } = useProfileStore();

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
  const totalScore = Object.values(levelProgress).reduce((acc, curr) => acc + (curr.bestScore || 0), 0);

  // Modals state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [levelsVisible, setLevelsVisible] = useState(false);

  // Leaderboard states
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'global' | 'friends'>('global');
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'level' | 'score' | 'coins' | 'bestTime'>('score');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLastDoc, setLeaderboardLastDoc] = useState<any>(null);
  const [leaderboardHasMore, setLeaderboardHasMore] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardLoadingMore, setLeaderboardLoadingMore] = useState(false);
  const [stickyPlayerEntry, setStickyPlayerEntry] = useState<LeaderboardEntry | null>(null);
  const [groups, setGroups] = useState<LeaderboardGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Create Group states
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupPublic, setNewGroupPublic] = useState(true);
  const [newGroupMax, setNewGroupMax] = useState('50');

  // Join Group states
  const [joinGroupVisible, setJoinGroupVisible] = useState(false);
  const [joinGroupCode, setJoinGroupCode] = useState('');

  // ─── Social Hub states ─────────────────────────────────────────────────
  const [socialHubVisible, setSocialHubVisible] = useState(false);
  const [socialTab, setSocialTab] = useState<'friends' | 'search' | 'requests' | 'invites'>('friends');
  const [friendsList, setFriendsList] = useState<FriendProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [battleInvites, setBattleInvites] = useState<BattleInvite[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [incomingInviteCount, setIncomingInviteCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  // Battle Hub states
  const [battleHubVisible, setBattleHubVisible] = useState(false);
  const [battleStep, setBattleStep] = useState<'menu' | 'botDiff' | 'roomWait' | 'roomJoin'>('menu');
  const [battleRoomCode, setBattleRoomCode] = useState('');
  const [enteredRoomCode, setEnteredRoomCode] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Profile Form states
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileFormTitle, setProfileFormTitle] = useState<'create' | 'edit'>('create');
  const [formName, setFormName] = useState('');
  const [formAvatarId, setFormAvatarId] = useState('avatar_1');
  const [formCountry, setFormCountry] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Enforce profile creation at launch
  useEffect(() => {
    if (!isProfileCreated) {
      setProfileFormTitle('create');
      setFormName('');
      setFormAvatarId('avatar_1');
      setFormCountry('');
      setFormError(null);
      setProfileModalVisible(true);
    }
  }, [isProfileCreated]);

  // Load Leaderboard data on change
  useEffect(() => {
    if (leaderboardVisible) {
      loadLeaderboardData();
      if (leaderboardTab === 'friends') {
        loadGroups();
      }
    }
  }, [leaderboardVisible, leaderboardTab, leaderboardSortBy, selectedGroupId]);

  // Online presence: mark online on mount, offline on unmount
  useEffect(() => {
    SocialService.setOnline();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        SocialService.setOnline();
      } else if (nextState === 'background' || nextState === 'inactive') {
        SocialService.setOffline();
      }
      appStateRef.current = nextState;
    });
    return () => {
      SocialService.setOffline();
      sub.remove();
    };
  }, []);

  // Poll incoming friend requests + battle invites badge counts every 30s
  useEffect(() => {
    const pollBadges = async () => {
      try {
        const [reqs, invites] = await Promise.all([
          SocialService.getIncomingRequests(),
          SocialService.getIncomingBattleInvites(),
        ]);
        setRequestCount(reqs.length);
        setIncomingInviteCount(invites.length);
      } catch (e) {}
    };
    pollBadges();
    const interval = setInterval(pollBadges, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real opponent joining the host room via RTDB status updates
  useEffect(() => {
    if (battleHubVisible && battleStep === 'roomWait') {
      const battleService = services.get<IBattleService>('Battle');
      battleService.onStatusChange((status) => {
        if (status === 'active') {
          haptics.success();
          audio.playSound('reward');
          Alert.alert(
            t('battle.opponentJoined'),
            language === 'vi' 
              ? 'Đối thủ đã tham gia phòng đấu! Nhấn nút để bắt đầu.'
              : 'Opponent joined the lobby! Tap to start.',
            [
              {
                text: language === 'vi' ? 'BẮT ĐẦU ĐẤU' : 'START DUEL',
                onPress: () => {
                  setBattleHubVisible(false);
                  setBattleStep('menu');
                  router.replace(`/battle?mode=room&roomCode=${battleRoomCode}`);
                },
              },
            ]
          );
        }
      });
    }
  }, [battleHubVisible, battleStep, battleRoomCode]);

  const loadLeaderboardData = async () => {
    setLeaderboardLoading(true);
    setLeaderboardLastDoc(null);
    setLeaderboardHasMore(false);
    setStickyPlayerEntry(null);
    try {
      if (leaderboardTab === 'global') {
        const res = await LeaderboardService.getGlobal(leaderboardSortBy, 20);
        setLeaderboardData(res.entries);
        setLeaderboardLastDoc(res.lastDoc || null);
        setLeaderboardHasMore(!!(res.lastDoc));
        // Set sticky player entry if current user is not visible on this page
        const myUid = res.entries.find(e => e.userId === 'player_self');
        if (!myUid && displayName) {
          setStickyPlayerEntry({
            userId: 'player_self',
            username: displayName,
            avatarId: avatarId,
            country: '',
            level: campaignProgressLevel,
            score: totalScore,
            coins: 0,
            bestTime: 999,
          });
        }
      } else {
        if (selectedGroupId) {
          const data = await LeaderboardService.getFriends(selectedGroupId, leaderboardSortBy, 50);
          setLeaderboardData(data);
          setLeaderboardHasMore(false);
        } else {
          setLeaderboardData([]);
        }
      }
    } catch (e) {
      console.warn('Failed to load leaderboard data', e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const loadMoreLeaderboard = async () => {
    if (!leaderboardLastDoc || leaderboardLoadingMore) return;
    setLeaderboardLoadingMore(true);
    try {
      const res = await LeaderboardService.getGlobal(leaderboardSortBy, 20, leaderboardLastDoc);
      setLeaderboardData(prev => [...prev, ...res.entries]);
      setLeaderboardLastDoc(res.lastDoc || null);
      setLeaderboardHasMore(!!(res.lastDoc));
    } catch (e) {
      console.warn('Failed to load more leaderboard', e);
    } finally {
      setLeaderboardLoadingMore(false);
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

  const handleJoinGroupSubmit = async () => {
    if (!joinGroupCode.trim()) return;
    try {
      const joined = await LeaderboardService.joinGroup(joinGroupCode.trim());
      setJoinGroupCode('');
      setJoinGroupVisible(false);
      const list = await LeaderboardService.getGroups();
      setGroups(list);
      setSelectedGroupId(joined.id);
      setLeaderboardTab('friends');
    } catch (e: any) {
      Alert.alert('Lỗi / Error', e?.message || 'Không tìm thấy nhóm. Kiểm tra lại mã mời.');
    }
  };

  const handleLeaveGroup = (groupId: string, groupName: string) => {
    Alert.alert(
      'Rời nhóm',
      `Bạn có muốn rời khỏi nhóm "${groupName}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm', style: 'destructive',
          onPress: async () => {
            try {
              await LeaderboardService.leaveGroup(groupId);
              if (selectedGroupId === groupId) setSelectedGroupId('');
              await loadGroups();
            } catch (e) {
              console.warn('Failed to leave group', e);
            }
          },
        },
      ]
    );
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    Alert.alert(
      'Xóa nhóm',
      `Xóa nhóm "${groupName}" sẽ xóa toàn bộ dữ liệu nhóm. Tiếp tục?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: async () => {
            try {
              await LeaderboardService.deleteGroup(groupId);
              if (selectedGroupId === groupId) setSelectedGroupId('');
              await loadGroups();
            } catch (e) {
              Alert.alert('Lỗi', 'Chỉ chủ nhóm mới có thể xóa nhóm.');
            }
          },
        },
      ]
    );
  };

  const handleCreateGroupSubmit = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm.');
      return;
    }
    try {
      const newGroup = await LeaderboardService.createGroup(
        newGroupName.trim(),
        newGroupDesc.trim(),
        newGroupPublic,
        parseInt(newGroupMax) || 50
      );
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupMax('50');
      setCreateGroupVisible(false);
      // Refresh groups list and select new group
      const list = await LeaderboardService.getGroups();
      setGroups(list);
      setSelectedGroupId(newGroup.id);
      setLeaderboardTab('friends');
      if (newGroup.inviteCode) {
        Alert.alert(
          '🎉 Nhóm đã tạo!',
          `Mã mời của bạn: ${newGroup.inviteCode}\n\nHãy chia sẻ mã này với bạn bè để họ tham gia nhóm.`
        );
      }
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

  const handleProfileFormSubmit = () => {
    audio.playSound('click');
    haptics.selection();

    const validationErrorKey = ProfileService.validateDisplayName(formName);
    if (validationErrorKey) {
      setFormError(t(validationErrorKey as any));
      haptics.error();
      return;
    }

    setFormError(null);
    updateProfile(formName.trim(), formAvatarId, formCountry.trim().toUpperCase());
    setProfileModalVisible(false);
  };

  const handleEditProfileOpen = () => {
    audio.playSound('click');
    haptics.selection();
    setProfileFormTitle('edit');
    setFormName(displayName);
    setFormAvatarId(avatarId || 'avatar_1');
    setFormCountry(country || '');
    setFormError(null);
    setSettingsVisible(false);
    setProfileModalVisible(true);
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

  const handleResetLevels = () => {
    audio.playSound('click');
    haptics.selection();
    Alert.alert(
      language === 'vi' ? 'Đặt lại tiến trình' : 'Reset Level Progress',
      language === 'vi'
        ? 'Bạn có chắc chắn muốn đặt lại tiến trình chơi về Cấp 1 không? Xu và Hồ sơ của bạn sẽ được giữ nguyên.'
        : 'Are you sure you want to reset your level progress back to Level 1? Your coins and profile will be kept.',
      [
        { text: t('settings.resetAlertCancel'), style: 'cancel' },
        {
          text: t('settings.resetAlertSuccess'),
          style: 'destructive',
          onPress: async () => {
            // Clear profile level progress
            useProfileStore.setState({
              levelProgress: {},
              seasonPassStars: 0,
            });
            // Reset gameStore currentLevel
            useGameStore.setState({ currentLevel: 1 });

            // Sync player self score to 0 levels
            const profile = useProfileStore.getState();
            try {
               await LeaderboardService.savePlayerScore(
                 profile.displayName || 'Player',
                 0,
                 0,
                 profile.coins,
                 999,
                 profile.avatarId,
                 profile.country
               );
            } catch (e) {
               console.warn(e);
            }

            // Close levels modal
            setLevelsVisible(false);

            Alert.alert(
              language === 'vi' ? 'Đã làm mới' : 'Reset Complete',
              language === 'vi'
                ? 'Đã đặt lại tiến trình cấp độ về Cấp 1.'
                : 'Level progress has been reset to Level 1.'
            );
          },
        },
      ]
    );
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
          onPress: async () => {
            // Close settings modal
            setSettingsVisible(false);

            // Reset game state
            resetGame();

            // Reset profile store
            useProfileStore.getState().resetProfile();

            // Clear local leaderboard score
            try {
              await AsyncStorage.removeItem('wsp_player_self_score');
              await AsyncStorage.removeItem('wsp_leaderboard_players');
              await AsyncStorage.removeItem('wsp_leaderboard_groups');
              await AsyncStorage.removeItem('wsp_leaderboard_friend_stats');
            } catch (e) {
              console.warn(e);
            }

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

  // ─── Social Handlers ─────────────────────────────────────────────────
  const loadSocialData = async () => {
    setSocialLoading(true);
    try {
      const [friends, reqs, invites] = await Promise.all([
        SocialService.getFriends(),
        SocialService.getIncomingRequests(),
        SocialService.getIncomingBattleInvites(),
      ]);
      setFriendsList(friends);
      setFriendRequests(reqs);
      setBattleInvites(invites);
      setRequestCount(reqs.length);
      setIncomingInviteCount(invites.length);
    } catch (e) {
      console.warn('Failed to load social data', e);
    } finally {
      setSocialLoading(false);
    }
  };

  const handlePlayerSearch = async (q: string) => {
    setPlayerSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const results = await SocialService.searchPlayers(q);
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (toUid: string, name: string) => {
    try {
      await SocialService.sendFriendRequest(toUid);
      Alert.alert('✅ Đã gửi', `Lời mời kết bạn đến ${name} đã được gửi!`);
    } catch (e: any) {
      if (e?.message === 'already_friends') Alert.alert('Thông báo', `Bạn và ${name} đã là bạn bè rồi.`);
      else if (e?.message === 'request_already_sent') Alert.alert('Thông báo', 'Bạn đã gửi lời mời rồi.');
      else Alert.alert('Lỗi', 'Không thể gửi lời mời. Thử lại sau.');
    }
  };

  const handleAcceptRequest = async (req: FriendRequest) => {
    try {
      await SocialService.acceptFriendRequest(req.id);
      Alert.alert('✅ Đã chấp nhận', `Bạn và ${req.fromDisplayName} đã trở thành bạn bè!`);
      await loadSocialData();
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể chấp nhận. Thử lại sau.');
    }
  };

  const handleRejectRequest = async (req: FriendRequest) => {
    await SocialService.rejectFriendRequest(req.id);
    await loadSocialData();
  };

  const handleRemoveFriend = (friend: FriendProfile) => {
    Alert.alert(
      'Xóa bạn',
      `Xóa ${friend.displayName} khỏi danh sách bạn bè?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: async () => {
            await SocialService.removeFriend(friend.uid);
            await loadSocialData();
          },
        },
      ]
    );
  };

  const handleSendBattleInvite = async (friend: FriendProfile) => {
    try {
      const battleService = services.get<IBattleService>('Battle');
      const session = await battleService.createRoom();
      await SocialService.sendBattleInvite(friend.uid, session.roomId);
      Alert.alert('🎮 Lời mời gửi!', `Đã mời ${friend.displayName} vào trận đấu! Họ sẽ nhận thông báo.`);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể gửi lời mời battle.');
    }
  };

  const handleRespondBattleInvite = async (invite: BattleInvite, accept: boolean) => {
    await SocialService.respondBattleInvite(invite.id, accept);
    if (accept) {
      Alert.alert('🎮 Battle!', `Đã chấp nhận lời mời từ ${invite.fromDisplayName}! Mã phòng: ${invite.roomId}`);
    }
    await loadSocialData();
  };

  return (
    <View style={styles.container}>
      {/* Premium Ambient Background */}
      <GameBackground />

      {/* Main Content */}
      <View style={styles.content}>
        
        {/* Region 0: Player Profile Header Card */}
        {isProfileCreated && (
          <View style={styles.playerCardContainer}>
            <View style={styles.playerCardAvatar}>
              <Text style={styles.playerCardAvatarEmoji}>{getAvatarEmoji(avatarId)}</Text>
            </View>
            <View style={styles.playerCardInfo}>
              <View style={styles.playerCardNameRow}>
                <Text style={styles.playerCardName} numberOfLines={1}>{displayName}</Text>
                {country ? <Text style={styles.playerCardCountry}>({country})</Text> : null}
              </View>
              <View style={styles.playerCardStats}>
                <Text style={styles.playerCardStatText}>Lvl {campaignProgressLevel}</Text>
                <View style={styles.playerCardStatDivider} />
                <Text style={[styles.playerCardStatText, { color: '#fbbf24' }]}>🪙 {coins}</Text>
                <View style={styles.playerCardStatDivider} />
                <Text style={styles.playerCardStatText}>{totalScore} pts</Text>
              </View>
            </View>
          </View>
        )}

        {/* Title Container with Ambient Neon Glow */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>{t('home.title')}</Text>
          <Text style={styles.subtitleText}>{t('home.subtitle')}</Text>
        </View>

        {/* Level Info & Play Button */}
        <View style={styles.centerContainer}>
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
              <Ionicons name="map" size={18} color="#cbd5e1" />
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
              <Ionicons name="trophy" size={18} color="#cbd5e1" />
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
              <Ionicons name="bar-chart" size={18} color="#cbd5e1" />
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
              <Ionicons name="settings" size={18} color="#cbd5e1" />
              <Text style={styles.menuButtonText}>{t('home.settings')}</Text>
            </View>
          </Pressable>

          {/* Social Hub Button */}
          <Pressable
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.pressedScaleSmall,
            ]}
            onPress={() => {
              audio.playSound('click');
              haptics.selection();
              setSocialHubVisible(true);
              setSocialTab('friends');
              loadSocialData();
            }}
          >
            <View style={styles.menuButtonContent}>
              <View>
                <Ionicons name="people" size={18} color="#a78bfa" />
                {(requestCount > 0 || incomingInviteCount > 0) && (
                  <View style={styles.socialBadge}>
                    <Text style={styles.socialBadgeText}>
                      {requestCount + incomingInviteCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.menuButtonText, { color: '#a78bfa' }]}>Bạn bè</Text>
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
                styles.editProfileMenuBtn,
                pressed && styles.pressedScaleSmall,
              ]}
              onPress={handleEditProfileOpen}
            >
              <Text style={styles.editProfileMenuBtnText}>{t('settings.editProfile' as any)}</Text>
            </Pressable>

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
                styles.resetLevelsButton,
                pressed && styles.pressedScaleSmall,
              ]}
              onPress={handleResetLevels}
            >
              <Text style={styles.resetLevelsButtonText}>{t('levels.reset')}</Text>
            </Pressable>

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
                      onLongPress={() => {
                        Alert.alert(
                          g.name,
                          g.inviteCode ? `Mã mời: ${g.inviteCode}` : '',
                          [
                            { text: 'Đóng', style: 'cancel' },
                            {
                              text: 'Rời nhóm',
                              onPress: () => handleLeaveGroup(g.id, g.name),
                            },
                            ...(g.ownerUid === 'player_self' ? [{ text: 'Xóa nhóm', style: 'destructive' as const, onPress: () => handleDeleteGroup(g.id, g.name) }] : []),
                          ]
                        );
                      }}
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
                  <Pressable
                    style={[styles.groupAddButton, { marginLeft: 4 }]}
                    onPress={() => {
                      audio.playSound('click');
                      haptics.selection();
                      setJoinGroupVisible(true);
                    }}
                  >
                    <Ionicons name="enter-outline" size={14} color="#e2e8f0" />
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
                      item.rank === 1 && styles.rankRowFirst,
                      item.rank === 2 && styles.rankRowSecond,
                      item.rank === 3 && styles.rankRowThird,
                      item.userId === 'player_self' && styles.rankRowSelf,
                    ]}
                  >
                    <View style={styles.rankColRank}>
                      {renderRankBadge(item.rank || 0)}
                    </View>
                    <View style={styles.rankColProfile}>
                      <Text style={styles.rankAvatarEmoji}>{getAvatarEmoji(item.avatarId)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                        <Text
                          style={[
                            styles.rankColName,
                            item.userId === 'player_self' && styles.rankColNameSelf,
                          ]}
                          numberOfLines={1}
                        >
                          {item.userId === 'player_self' ? `${item.username} (You)` : item.username}
                        </Text>
                        {item.movement === 'up' && (
                          <Text style={{ color: '#22c55e', fontSize: 10, marginLeft: 3, fontWeight: 'bold' }}>▲</Text>
                        )}
                        {item.movement === 'down' && (
                          <Text style={{ color: '#ef4444', fontSize: 10, marginLeft: 3, fontWeight: 'bold' }}>▼</Text>
                        )}
                      </View>
                      {item.country ? (
                        <Text style={styles.rankColCountry}>({item.country})</Text>
                      ) : null}
                    </View>
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

              {/* Load More Button */}
              {leaderboardTab === 'global' && leaderboardHasMore && (
                <Pressable
                  style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressedScaleSmall]}
                  onPress={loadMoreLeaderboard}
                  disabled={leaderboardLoadingMore}
                >
                  <Text style={styles.loadMoreButtonText}>
                    {leaderboardLoadingMore ? 'Đang tải...' : '⬇ Xem thêm'}
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            {/* Sticky Player Row (if player is not in the current page) */}
            {stickyPlayerEntry && leaderboardTab === 'global' && (
              <View style={[styles.rankRow, styles.rankRowSelf, { marginTop: 4, borderRadius: 10 }]}>
                <View style={styles.rankColRank}>
                  <Text style={styles.rankBadgeText}>–</Text>
                </View>
                <View style={styles.rankColProfile}>
                  <Text style={styles.rankAvatarEmoji}>{getAvatarEmoji(stickyPlayerEntry.avatarId)}</Text>
                  <Text style={[styles.rankColName, styles.rankColNameSelf]} numberOfLines={1}>
                    {stickyPlayerEntry.username} (You)
                  </Text>
                </View>
                <Text style={[styles.rankColValue, styles.rankColValueSelf]}>
                  {renderValueText(stickyPlayerEntry)}
                </Text>
              </View>
            )}

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
            <Text style={styles.dialogTitle}>🏆 {t('leaderboard.createGroup')}</Text>

            <TextInput
              style={styles.dialogInput}
              placeholder="Tên nhóm (vd: Hội bạn thân)"
              placeholderTextColor="#64748b"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <TextInput
              style={[styles.dialogInput, { height: 60, textAlignVertical: 'top', paddingTop: 10 }]}
              placeholder="Mô tả nhóm (tuỳ chọn)"
              placeholderTextColor="#64748b"
              multiline
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
            />

            <TextInput
              style={styles.dialogInput}
              placeholder="Số thành viên tối đa (mặc định: 50)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={newGroupMax}
              onChangeText={setNewGroupMax}
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

      {/* DIALOG: JOIN GROUP VIA INVITE CODE */}
      <Modal visible={joinGroupVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>🔑 Tham gia nhóm</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
              Nhập mã mời từ bạn bè để tham gia nhóm xếp hạng.
            </Text>

            <TextInput
              style={[styles.dialogInput, { letterSpacing: 3, textAlign: 'center', fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase' }]}
              placeholder="VD: WSP84A"
              placeholderTextColor="#475569"
              value={joinGroupCode}
              onChangeText={(v) => setJoinGroupCode(v.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
            />

            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancelBtn}
                onPress={() => { setJoinGroupVisible(false); setJoinGroupCode(''); }}
              >
                <Text style={styles.dialogCancelBtnText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={styles.dialogCreateBtn}
                onPress={handleJoinGroupSubmit}
              >
                <Text style={styles.dialogCreateBtnText}>Tham gia</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 5.5: SOCIAL HUB */}
      <Modal visible={socialHubVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.glassModalContent, { height: '82%', width: '94%' }]}>
            <Text style={styles.modalTitle}>👥 Bạn bè</Text>

            {/* Social Tabs */}
            <View style={[styles.leaderboardTabs, { marginBottom: 8 }]}>
              {(['friends', 'search', 'requests', 'invites'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.leaderboardTab, socialTab === tab && styles.leaderboardTabActive]}
                  onPress={() => setSocialTab(tab)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.leaderboardTabText, socialTab === tab && styles.leaderboardTabTextActive]}>
                      {tab === 'friends' ? '👤 Bạn' : tab === 'search' ? '🔍 Tìm' : tab === 'requests' ? '✉️ Mời' : '⚔️ Battle'}
                    </Text>
                    {tab === 'requests' && requestCount > 0 && (
                      <View style={styles.socialBadge}><Text style={styles.socialBadgeText}>{requestCount}</Text></View>
                    )}
                    {tab === 'invites' && incomingInviteCount > 0 && (
                      <View style={styles.socialBadge}><Text style={styles.socialBadgeText}>{incomingInviteCount}</Text></View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>

            {socialLoading ? (
              <ActivityIndicator color="#a78bfa" style={{ marginTop: 40 }} />
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>

                {/* ─── FRIENDS TAB ─── */}
                {socialTab === 'friends' && (
                  friendsList.length === 0 ? (
                    <View style={styles.emptyView}>
                      <Ionicons name="people-outline" size={40} color="#475569" style={{ marginBottom: 8 }} />
                      <Text style={styles.emptyText}>{'Ch\u01b0a c\u00f3 b\u1ea1n b\u00e8 n\u00e0o.\nH\u00e3y t\u00ecm ki\u1ebfm v\u00e0 g\u1eedi l\u1eddi m\u1eddi k\u1ebft b\u1ea1n!'}</Text>
                    </View>
                  ) : friendsList.map((friend) => (
                    <View key={friend.uid} style={styles.socialFriendRow}>
                      <Text style={styles.rankAvatarEmoji}>{getAvatarEmoji(friend.avatarId)}</Text>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.rankColName} numberOfLines={1}>{friend.displayName}</Text>
                          <View style={[styles.onlineDot, { backgroundColor: friend.isOnline ? '#22c55e' : '#475569' }]} />
                        </View>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>Lv.{friend.highestLevel} • {friend.totalScore} pts</Text>
                      </View>
                      <Pressable style={styles.socialActionBtn} onPress={() => handleSendBattleInvite(friend)}>
                        <Ionicons name="game-controller-outline" size={14} color="#fbbf24" />
                      </Pressable>
                      <Pressable style={[styles.socialActionBtn, { backgroundColor: 'rgba(239,68,68,0.12)', marginLeft: 4 }]} onPress={() => handleRemoveFriend(friend)}>
                        <Ionicons name="person-remove-outline" size={14} color="#f87171" />
                      </Pressable>
                    </View>
                  ))
                )}

                {/* ─── SEARCH TAB ─── */}
                {socialTab === 'search' && (
                  <View>
                    <TextInput
                      style={[styles.dialogInput, { marginHorizontal: 0, marginBottom: 12 }]}
                      placeholder="Tìm kiếm theo tên người chơi..."
                      placeholderTextColor="#475569"
                      value={playerSearchQuery}
                      onChangeText={handlePlayerSearch}
                      autoCapitalize="none"
                    />
                    {searchLoading && <ActivityIndicator color="#a78bfa" />}
                    {searchResults.map((player) => (
                      <View key={player.uid} style={styles.socialFriendRow}>
                        <Text style={styles.rankAvatarEmoji}>{getAvatarEmoji(player.avatarId)}</Text>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.rankColName} numberOfLines={1}>{player.displayName}</Text>
                          <Text style={{ color: '#64748b', fontSize: 11 }}>Lv.{player.highestLevel} • {player.totalScore} pts</Text>
                        </View>
                        <Pressable
                          style={[styles.socialActionBtn, { backgroundColor: 'rgba(99,102,241,0.18)' }]}
                          onPress={() => handleSendFriendRequest(player.uid, player.displayName)}
                        >
                          <Ionicons name="person-add-outline" size={14} color="#a5b4fc" />
                        </Pressable>
                      </View>
                    ))}
                    {!searchLoading && playerSearchQuery.length >= 2 && searchResults.length === 0 && (
                      <Text style={[styles.emptyText, { marginTop: 20 }]}>Không tìm thấy người chơi nào.</Text>
                    )}
                  </View>
                )}

                {/* ─── REQUESTS TAB ─── */}
                {socialTab === 'requests' && (
                  friendRequests.length === 0 ? (
                    <View style={styles.emptyView}>
                      <Ionicons name="mail-outline" size={40} color="#475569" style={{ marginBottom: 8 }} />
                      <Text style={styles.emptyText}>Không có lời mời kết bạn nào.</Text>
                    </View>
                  ) : friendRequests.map((req) => (
                    <View key={req.id} style={styles.socialFriendRow}>
                      <Text style={styles.rankAvatarEmoji}>{getAvatarEmoji(req.fromAvatarId)}</Text>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.rankColName} numberOfLines={1}>{req.fromDisplayName}</Text>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>Muốn kết bạn với bạn</Text>
                      </View>
                      <Pressable style={styles.socialActionBtn} onPress={() => handleAcceptRequest(req)}>
                        <Ionicons name="checkmark" size={16} color="#22c55e" />
                      </Pressable>
                      <Pressable style={[styles.socialActionBtn, { backgroundColor: 'rgba(239,68,68,0.12)', marginLeft: 4 }]} onPress={() => handleRejectRequest(req)}>
                        <Ionicons name="close" size={16} color="#f87171" />
                      </Pressable>
                    </View>
                  ))
                )}

                {/* ─── BATTLE INVITES TAB ─── */}
                {socialTab === 'invites' && (
                  battleInvites.length === 0 ? (
                    <View style={styles.emptyView}>
                      <Ionicons name="game-controller-outline" size={40} color="#475569" style={{ marginBottom: 8 }} />
                      <Text style={styles.emptyText}>Không có lời mời battle nào.</Text>
                    </View>
                  ) : battleInvites.map((invite) => (
                    <View key={invite.id} style={styles.socialFriendRow}>
                      <Ionicons name="game-controller" size={24} color="#fbbf24" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.rankColName} numberOfLines={1}>{invite.fromDisplayName}</Text>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>Mã phòng: {invite.roomId}</Text>
                      </View>
                      <Pressable style={styles.socialActionBtn} onPress={() => handleRespondBattleInvite(invite, true)}>
                        <Ionicons name="checkmark" size={16} color="#22c55e" />
                      </Pressable>
                      <Pressable style={[styles.socialActionBtn, { backgroundColor: 'rgba(239,68,68,0.12)', marginLeft: 4 }]} onPress={() => handleRespondBattleInvite(invite, false)}>
                        <Ionicons name="close" size={16} color="#f87171" />
                      </Pressable>
                    </View>
                  ))
                )}

              </ScrollView>
            )}

            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressedScaleSmall, { marginTop: 8 }]}
              onPress={() => setSocialHubVisible(false)}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </Pressable>
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

                <View style={styles.lobbyHostCard}>
                  <Text style={styles.lobbyHostLabel}>Host:</Text>
                  <Text style={styles.lobbyHostAvatar}>{getAvatarEmoji(avatarId)}</Text>
                  <Text style={styles.lobbyHostName}>{displayName}</Text>
                </View>

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

      {/* MODAL 6: CREATE / EDIT PROFILE OVERLAY */}
      <Modal visible={profileModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>
              {profileFormTitle === 'create' ? t('profile.createTitle' as any) : t('profile.editTitle' as any)}
            </Text>

            {profileFormTitle === 'edit' && playerId && (
              <View style={styles.dialogPlayerIdRow}>
                <Text style={styles.dialogPlayerIdLabel}>{t('profile.playerIdLabel' as any)}:</Text>
                <Text style={styles.dialogPlayerIdText} numberOfLines={1}>{playerId}</Text>
              </View>
            )}

            <Text style={styles.dialogFieldLabel}>{t('profile.nameLabel' as any)}*</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder={t('profile.enterName' as any)}
              placeholderTextColor="#64748b"
              maxLength={20}
              value={formName}
              onChangeText={setFormName}
            />

            <Text style={styles.dialogFieldLabel}>{t('profile.avatarLabel' as any)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarPickerScroll}>
              {Object.entries(AVATARS).map(([id, emoji]) => (
                <Pressable
                  key={id}
                  style={[
                    styles.avatarPickOption,
                    formAvatarId === id && styles.avatarPickOptionSelected,
                  ]}
                  onPress={() => setFormAvatarId(id)}
                >
                  <Text style={styles.avatarPickEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.dialogFieldLabel}>{t('profile.countryLabel' as any)}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder={t('profile.enterCountry' as any)}
              placeholderTextColor="#64748b"
              maxLength={10}
              value={formCountry}
              onChangeText={setFormCountry}
            />

            {formError && <Text style={styles.dialogErrorText}>{formError}</Text>}

            <View style={styles.dialogActions}>
              {profileFormTitle === 'edit' && (
                <Pressable
                  style={styles.dialogCancelBtn}
                  onPress={() => setProfileModalVisible(false)}
                >
                  <Text style={styles.dialogCancelBtnText}>{t('leaderboard.cancel')}</Text>
                </Pressable>
              )}

              <Pressable
                style={[
                  styles.dialogCreateBtn,
                  profileFormTitle === 'create' && { marginLeft: 0 },
                ]}
                onPress={handleProfileFormSubmit}
              >
                <Text style={styles.dialogCreateBtnText}>{t('profile.save' as any)}</Text>
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
    marginTop: 20,
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
    width: '85%',
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    flex: 1,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#cbd5e1',
    marginTop: 4,
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
    marginBottom: 12,
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
  editProfileMenuBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    width: '100%',
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  editProfileMenuBtnText: {
    color: '#818cf8',
    fontWeight: '800',
    fontSize: 15,
  },
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    width: '100%',
    padding: 14,
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
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 10,
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
    justifyContent: 'center',
    width: '100%',
  },
  levelCard: {
    width: (SCREEN_WIDTH * 0.88 - 60) / 3,
    height: (SCREEN_WIDTH * 0.88 - 60) / 3,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    borderRadius: 16,
  },
  resetLevelsButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    width: '100%',
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  resetLevelsButtonText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1,
  },
  levelCardText: {
    color: '#818cf8',
    fontWeight: '800',
    fontSize: 14,
  },
  menuButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
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
  loadMoreButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 32,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  loadMoreButtonText: {
    color: '#a5b4fc',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
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
  rankRowFirst: {
    backgroundColor: 'rgba(251, 191, 36, 0.04)',
    borderColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 2,
  },
  rankRowSecond: {
    backgroundColor: 'rgba(203, 213, 225, 0.03)',
    borderColor: 'rgba(203, 213, 225, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: 2,
  },
  rankRowThird: {
    backgroundColor: 'rgba(180, 83, 9, 0.03)',
    borderColor: 'rgba(180, 83, 9, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
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
  rankColProfile: {
    width: '55%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
  },
  rankAvatarEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  rankColName: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 13,
  },
  rankColNameSelf: {
    color: '#34d399',
    fontWeight: '800',
  },
  rankColCountry: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    marginLeft: 4,
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
    width: '88%',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 20,
    alignItems: 'flex-start',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 16,
    alignSelf: 'center',
  },
  dialogFieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
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
    marginBottom: 14,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 14,
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
    fontSize: 14,
  },
  dialogCreateBtn: {
    flex: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: 6,
    backgroundColor: '#10b981',
    borderRadius: 14,
  },
  dialogCreateBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  dialogPlayerIdRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  dialogPlayerIdLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  dialogPlayerIdText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  dialogErrorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    alignSelf: 'center',
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
  // Player Card UI (Top of Screen)
  playerCardContainer: {
    width: SCREEN_WIDTH * 0.9,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  playerCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  playerCardAvatarEmoji: {
    fontSize: 24,
  },
  playerCardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  playerCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerCardName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  playerCardCountry: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818cf8',
    marginLeft: 6,
  },
  playerCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  playerCardStatText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  playerCardStatDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  // Avatar Picker Styles
  avatarPickerScroll: {
    width: '100%',
    maxHeight: 65,
    marginBottom: 14,
  },
  avatarPickOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarPickOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  avatarPickEmoji: {
    fontSize: 20,
  },
  lobbyHostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 10,
  },
  lobbyHostLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  lobbyHostAvatar: {
    fontSize: 16,
    marginRight: 6,
  },
  lobbyHostName: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },

  // ─── Social System Styles ───────────────────────────────────────────────
  socialBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  socialBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 14,
  },
  socialFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  socialActionBtn: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
