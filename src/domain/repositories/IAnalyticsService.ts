/**
 * Interface defining the Analytics tracking service.
 * Ready to be implemented by Firebase Analytics or custom providers.
 */
export interface IAnalyticsService {
  trackEvent(name: string, params?: Record<string, any>): void;
  setUserProperty(key: string, value: string): void;
}
