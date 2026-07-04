import { IAnalyticsService } from '../domain/repositories/IAnalyticsService';

/**
 * Concrete implementation of IAnalyticsService using console logging.
 * Ready to be swapped with Firebase Analytics for release.
 */
export class ConsoleAnalyticsService implements IAnalyticsService {
  trackEvent(name: string, params?: Record<string, any>): void {
    console.info(`[Analytics] Event: "${name}"`, params || {});
  }

  setUserProperty(key: string, value: string): void {
    console.info(`[Analytics] UserProperty: ${key} = "${value}"`);
  }
}
