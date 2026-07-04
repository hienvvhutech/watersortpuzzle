import { PlayerProfile } from '../types';

/**
 * Interface defining the Player Profile repository.
 * Decoupled from backend providers (ready to swap in FirebaseFirestoreProfileRepository).
 */
export interface IProfileRepository {
  /**
   * Fetches the player profile from the storage cache.
   */
  getProfile(): Promise<PlayerProfile | null>;

  /**
   * Saves the player profile to the storage cache.
   */
  saveProfile(profile: PlayerProfile): Promise<void>;

  /**
   * Checks if the profile has been created.
   */
  isProfileCreated(): Promise<boolean>;
}
