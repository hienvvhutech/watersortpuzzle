import { BattleSession } from '../types';

/**
 * Interface defining the Real-time Battle service.
 * Decoupled from backend provider (Firebase Realtime DB or Custom WS).
 */
export interface IBattleService {
  /**
   * Host a new multiplayer room.
   */
  createRoom(): Promise<BattleSession>;

  /**
   * Joins an existing room using a code.
   */
  joinRoom(roomId: string): Promise<BattleSession>;

  /**
   * Launches a local bot battle or starts the room countdown.
   */
  startBattle(botDifficulty?: 'easy' | 'medium' | 'hard'): Promise<BattleSession>;

  /**
   * Broadcasts the current player's solve progress percentage (0 - 100).
   */
  updatePlayerProgress(progress: number): void;

  /**
   * Subscribes to changes in the opponent's progress.
   */
  onOpponentProgressUpdate(callback: (progress: number) => void): void;

  /**
   * Subscribes to changes in the battle state.
   */
  onStatusChange(callback: (status: 'waiting' | 'active' | 'won' | 'lost') => void): void;

  /**
   * Leaves the current room session.
   */
  leaveRoom(): void;
}
