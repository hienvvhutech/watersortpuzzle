import { BattleSession } from '../domain/types';
import { IBattleService } from '../domain/repositories/IBattleService';
import { rtdb, auth } from './firebase';
import { ref, set, get, update, onValue, off, remove } from 'firebase/database';
import { useProfileStore } from '../presentation/store/profileStore';

export class FirebaseRTDBBattleService implements IBattleService {
  private roomCode: string | null = null;
  private isHostPlayer = false;
  private opponentProgressCallback: ((progress: number) => void) | null = null;
  private statusCallback: ((status: 'waiting' | 'active' | 'won' | 'lost') => void) | null = null;
  
  // Realtime Database references & unsubscribers
  private roomRef: any = null;
  private opponentProgressRef: any = null;
  private statusRef: any = null;
  
  private currentUid: string = '';

  private async ensureAuthenticated(): Promise<string> {
    if (this.currentUid) return this.currentUid;
    if (auth && auth.currentUser) {
      this.currentUid = auth.currentUser.uid;
      return this.currentUid;
    }
    // Fallback if not loaded/anonymous yet
    return 'anonymous_player_' + Math.floor(Math.random() * 10000);
  }

  async createRoom(): Promise<BattleSession> {
    if (!rtdb) {
      throw new Error('Realtime Database is not configured');
    }
    const uid = await this.ensureAuthenticated();
    const profile = useProfileStore.getState();
    
    // Generate a random 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.roomCode = code;
    this.isHostPlayer = true;
    
    const roomPath = `rooms/${code}`;
    const roomData = {
      roomId: code,
      status: 'waiting',
      createdAt: Date.now(),
      host: {
        uid,
        name: profile.displayName || 'Player Host',
        avatarId: profile.avatarId || 'avatar_1',
        progress: 0,
      },
      opponent: null,
      winnerUid: null,
    };

    this.roomRef = ref(rtdb, roomPath);
    await set(this.roomRef, roomData);

    // Setup active listeners immediately
    this.setupListeners();

    return {
      roomId: code,
      opponentName: 'Waiting...',
      opponentProgress: 0,
      isHost: true,
      status: 'waiting',
    };
  }

  async joinRoom(roomId: string): Promise<BattleSession> {
    if (!rtdb) {
      throw new Error('Realtime Database is not configured');
    }
    const cleanRoomId = roomId.trim().toUpperCase();
    const uid = await this.ensureAuthenticated();
    const profile = useProfileStore.getState();

    const roomPath = `rooms/${cleanRoomId}`;
    const roomSnapshot = await get(ref(rtdb, roomPath));
    
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found');
    }

    const roomData = roomSnapshot.val();
    if (roomData.status !== 'waiting' || roomData.opponent) {
      throw new Error('Room is full or already active');
    }

    this.roomCode = cleanRoomId;
    this.isHostPlayer = false;

    // Join the room as the opponent
    const updateData = {
      status: 'active',
      opponent: {
        uid,
        name: profile.displayName || 'Speedy_Sorter',
        avatarId: profile.avatarId || 'avatar_2',
        progress: 0,
      },
    };

    await update(ref(rtdb, roomPath), updateData);
    this.roomRef = ref(rtdb, roomPath);

    // Setup active listeners
    this.setupListeners();

    return {
      roomId: cleanRoomId,
      opponentName: roomData.host.name || 'Host Opponent',
      opponentProgress: 0,
      isHost: false,
      status: 'active',
    };
  }

  async startBattle(botDifficulty?: 'easy' | 'medium' | 'hard'): Promise<BattleSession> {
    // If not connected to RTDB room, return default active session (e.g. offline fallback / bot)
    if (!this.roomCode || !rtdb) {
      return {
        roomId: 'OFFLINE-BOT',
        opponentName: 'Bot Opponent',
        opponentProgress: 0,
        isHost: true,
        status: 'active',
      };
    }

    const roomSnapshot = await get(ref(rtdb, `rooms/${this.roomCode}`));
    const roomData = roomSnapshot.val();

    return {
      roomId: this.roomCode,
      opponentName: this.isHostPlayer ? (roomData?.opponent?.name || 'Opponent') : (roomData?.host?.name || 'Host'),
      opponentProgress: 0,
      isHost: this.isHostPlayer,
      status: 'active',
    };
  }

  updatePlayerProgress(progress: number): void {
    if (!this.roomCode || !rtdb) return;
    const uid = auth?.currentUser?.uid || this.currentUid;
    const path = `rooms/${this.roomCode}/${this.isHostPlayer ? 'host' : 'opponent'}/progress`;
    
    set(ref(rtdb, path), progress).catch(err => console.warn(err));

    if (progress >= 100) {
      // Set winnerUid if not already set by opponent
      const roomPath = `rooms/${this.roomCode}`;
      get(ref(rtdb, `${roomPath}/winnerUid`)).then((snap) => {
        if (!snap.val() && rtdb) {
          update(ref(rtdb, roomPath), {
            winnerUid: uid,
            status: 'won', // Signal victory to both clients
          }).catch(err => console.warn(err));
        }
      });
    }
  }

  onOpponentProgressUpdate(callback: (progress: number) => void): void {
    this.opponentProgressCallback = callback;
  }

  onStatusChange(callback: (status: 'waiting' | 'active' | 'won' | 'lost') => void): void {
    this.statusCallback = callback;
  }

  leaveRoom(): void {
    this.cleanupListeners();
    
    if (this.roomCode && rtdb) {
      const roomPath = `rooms/${this.roomCode}`;
      if (this.isHostPlayer) {
        // Host leaves: completely remove room node
        remove(ref(rtdb, roomPath)).catch(err => console.warn(err));
      } else {
        // Opponent leaves: reset opponent data and change status back to waiting
        update(ref(rtdb, roomPath), {
          status: 'abandoned',
        }).catch(err => console.warn(err));
      }
    }
    
    this.roomCode = null;
    this.opponentProgressCallback = null;
    this.statusCallback = null;
  }

  private setupListeners() {
    if (!rtdb || !this.roomCode) return;

    const roomPath = `rooms/${this.roomCode}`;

    // Listen to Opponent's progress changes
    const progressPath = `${roomPath}/${this.isHostPlayer ? 'opponent' : 'host'}/progress`;
    this.opponentProgressRef = ref(rtdb, progressPath);
    onValue(this.opponentProgressRef, (snapshot) => {
      const val = snapshot.val();
      if (typeof val === 'number' && this.opponentProgressCallback) {
        this.opponentProgressCallback(val);
      }
    });

    // Listen to Room Status and Winner details
    this.statusRef = ref(rtdb, roomPath);
    onValue(this.statusRef, (snapshot) => {
      if (!snapshot.exists()) {
        // If room is removed (e.g. host deleted room)
        if (this.statusCallback) {
          this.statusCallback('lost'); // Treat deleted room as lost/connection terminated
        }
        return;
      }
      
      const val = snapshot.val();
      const currentUid = auth?.currentUser?.uid || this.currentUid;
      
      if (val.status === 'active' && this.statusCallback) {
        this.statusCallback('active');
      }

      if (val.winnerUid) {
        if (this.statusCallback) {
          if (val.winnerUid === currentUid) {
            this.statusCallback('won');
          } else {
            this.statusCallback('lost');
          }
        }
      } else if (val.status === 'abandoned' && this.statusCallback) {
        this.statusCallback('won'); // Opponent left, we win automatically
      }
    });
  }

  private cleanupListeners() {
    if (this.opponentProgressRef) {
      off(this.opponentProgressRef);
      this.opponentProgressRef = null;
    }
    if (this.statusRef) {
      off(this.statusRef);
      this.statusRef = null;
    }
  }
}
