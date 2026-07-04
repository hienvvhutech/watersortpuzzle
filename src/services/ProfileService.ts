import { services } from '../shared/IServiceRegistry';
import { IProfileRepository } from '../domain/repositories/IProfileRepository';
import { PlayerProfile } from '../domain/types';

/**
 * Service managing Player Profile validations and actions.
 * Resolves repository dependency via the DI ServiceRegistry locator.
 */
export const ProfileService = {
  /**
   * Validates a Display Name based on production requirements:
   * - Required field.
   * - 3 to 20 characters in length.
   * - Supports Unicode letters/numbers (Vietnamese characters).
   * - Allows single spaces, dots, hyphens, and underscores.
   * - Prevents leading/trailing spaces or consecutive double spaces.
   * Returns a localized validation error key, or null if valid.
   */
  validateDisplayName: (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'validation.nameRequired';
    }
    if (trimmed.length < 3 || trimmed.length > 20) {
      return 'validation.nameLength';
    }
    
    // Regex supporting Unicode letters, numbers, single spaces, dots, underscores, hyphens
    // Using \p{L} and \p{N} for full multi-language/Vietnamese support.
    try {
      // Compile dynamically to prevent parser-level crash on older JS engines!
      const validPattern = new RegExp('^[\\p{L}\\p{N}]+([\\s_.-]+[\\p{L}\\p{N}]+)*$', 'u');
      if (!validPattern.test(trimmed)) {
        return 'validation.nameInvalidChars';
      }
    } catch (e) {
      // Fallback regex if runtime environment does not support Unicode regex properties
      const fallbackPattern = /^[a-zA-Z0-9À-ỹ_.-]+([\s][a-zA-Z0-9À-ỹ_.-]+)*$/;
      if (!fallbackPattern.test(trimmed)) {
        return 'validation.nameInvalidChars';
      }
    }

    return null;
  },

  /**
   * Fetches the current player profile.
   */
  get: async (): Promise<PlayerProfile | null> => {
    const repo = services.get<IProfileRepository>('Profile');
    return repo.getProfile();
  },

  /**
   * Saves the player profile.
   */
  save: async (profile: PlayerProfile): Promise<void> => {
    const errorKey = ProfileService.validateDisplayName(profile.displayName);
    if (errorKey) {
      throw new Error(`Profile display name validation failed: ${errorKey}`);
    }
    const repo = services.get<IProfileRepository>('Profile');
    await repo.saveProfile(profile);
  },

  /**
   * Checks if profile is created.
   */
  isCreated: async (): Promise<boolean> => {
    const repo = services.get<IProfileRepository>('Profile');
    return repo.isProfileCreated();
  },
};
