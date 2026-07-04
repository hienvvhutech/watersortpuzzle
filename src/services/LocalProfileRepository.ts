import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProfile } from '../domain/types';
import { IProfileRepository } from '../domain/repositories/IProfileRepository';

const STORAGE_KEY = 'wsp_player_profile';

/**
 * AsyncStorage-backed local implementation of IProfileRepository.
 */
export class LocalProfileRepository implements IProfileRepository {
  async getProfile(): Promise<PlayerProfile | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  async saveProfile(profile: PlayerProfile): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  async isProfileCreated(): Promise<boolean> {
    const profile = await this.getProfile();
    return !!(profile && profile.isProfileCreated);
  }
}
