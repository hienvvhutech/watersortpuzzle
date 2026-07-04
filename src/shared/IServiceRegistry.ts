import { IAnalyticsService } from '../domain/repositories/IAnalyticsService';
import { IErrorService } from '../domain/repositories/IErrorService';
import { ILeaderboardRepository } from '../domain/repositories/ILeaderboardRepository';
import { IBattleService } from '../domain/repositories/IBattleService';
import { IProfileRepository } from '../domain/repositories/IProfileRepository';
import { ConsoleAnalyticsService } from '../services/ConsoleAnalyticsService';
import { ConsoleErrorService } from '../services/ConsoleErrorService';
import { LocalLeaderboardRepository } from '../services/LocalLeaderboardRepository';
import { LocalBattleService } from '../services/LocalBattleService';
import { LocalProfileRepository } from '../services/LocalProfileRepository';

/**
 * Type-safe Service Locator for Dependency Injection.
 * Standardizes repository and service instantiation for Google Play/App Store setups.
 */
class ServiceRegistry {
  private registry = new Map<string, any>();

  constructor() {
    // Register Phase 2, 3, 4 & 5 services
    this.registry.set('Analytics', new ConsoleAnalyticsService());
    this.registry.set('Error', new ConsoleErrorService());
    this.registry.set('Leaderboard', new LocalLeaderboardRepository());
    this.registry.set('Battle', new LocalBattleService());
    this.registry.set('Profile', new LocalProfileRepository());
  }

  /**
   * Registers a service singleton in the container.
   */
  register<T>(name: string, instance: T): void {
    this.registry.set(name, instance);
  }

  /**
   * Retrieves a registered service singleton.
   */
  get<T>(name: string): T {
    const instance = this.registry.get(name);
    if (!instance) {
      throw new Error(`Dependency Injection Error: Service "${name}" is not registered in the ServiceRegistry.`);
    }
    return instance as T;
  }
}

export const services = new ServiceRegistry();
export type { IAnalyticsService, IErrorService, IBattleService, IProfileRepository };
