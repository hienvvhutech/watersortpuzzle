import { BattleSession } from '../domain/types';
import { IBattleService } from '../domain/repositories/IBattleService';

export class LocalBattleService implements IBattleService {
  private session: BattleSession | null = null;
  private opponentProgressCallback: ((progress: number) => void) | null = null;
  private statusCallback: ((status: 'waiting' | 'active' | 'won' | 'lost') => void) | null = null;
  private simulationInterval: any = null;

  async createRoom(): Promise<BattleSession> {
    const code = Math.floor(1000 + Math.random() * 9000);
    this.session = {
      roomId: `ROOM-${code}`,
      opponentName: 'Bot Opponent',
      opponentProgress: 0,
      isHost: true,
      status: 'waiting',
    };
    return this.session;
  }

  async joinRoom(roomId: string): Promise<BattleSession> {
    // Simulate minor loading connection latency
    await new Promise((resolve) => setTimeout(resolve, 800));

    this.session = {
      roomId: roomId.toUpperCase(),
      opponentName: 'Speedy_Pourer',
      opponentProgress: 0,
      isHost: false,
      status: 'active',
    };

    if (this.statusCallback) {
      this.statusCallback('active');
    }

    return this.session;
  }

  async startBattle(botDifficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<BattleSession> {
    if (!this.session) {
      this.session = {
        roomId: 'OFFLINE-BOT',
        opponentName: 'Training_Bot',
        opponentProgress: 0,
        isHost: true,
        status: 'active',
      };
    }

    this.session.status = 'active';
    this.session.opponentProgress = 0;
    if (this.statusCallback) {
      this.statusCallback('active');
    }

    // Determine speed increments based on difficulty
    let minInc = 1;
    let maxInc = 3;
    if (botDifficulty === 'medium') {
      minInc = 2;
      maxInc = 4;
    } else if (botDifficulty === 'hard') {
      minInc = 3;
      maxInc = 6;
    }

    // Start background simulation
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    let currentProgress = 0;

    this.simulationInterval = setInterval(() => {
      if (!this.session || this.session.status !== 'active') {
        if (this.simulationInterval) clearInterval(this.simulationInterval);
        return;
      }

      const increment = Math.floor(minInc + Math.random() * (maxInc - minInc + 1));
      currentProgress = Math.min(100, currentProgress + increment);
      
      this.session.opponentProgress = currentProgress;

      if (this.opponentProgressCallback) {
        this.opponentProgressCallback(currentProgress);
      }

      if (currentProgress >= 100) {
        this.session.status = 'lost';
        if (this.statusCallback) {
          this.statusCallback('lost');
        }
        if (this.simulationInterval) clearInterval(this.simulationInterval);
      }
    }, 1000);

    return this.session;
  }

  updatePlayerProgress(progress: number): void {
    if (!this.session || this.session.status !== 'active') return;

    if (progress >= 100) {
      this.session.status = 'won';
      if (this.statusCallback) {
        this.statusCallback('won');
      }
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
      }
    }
  }

  onOpponentProgressUpdate(callback: (progress: number) => void): void {
    this.opponentProgressCallback = callback;
  }

  onStatusChange(callback: (status: 'waiting' | 'active' | 'won' | 'lost') => void): void {
    this.statusCallback = callback;
  }

  leaveRoom(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    this.session = null;
    this.opponentProgressCallback = null;
    this.statusCallback = null;
  }
}
