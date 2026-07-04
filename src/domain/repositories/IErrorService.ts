/**
 * Interface defining the Error and Crash reporting service.
 * Ready to be implemented by Firebase Crashlytics or custom error boundaries.
 */
export interface IErrorService {
  logError(error: Error, context?: string): void;
  logBreadcrumb(message: string): void;
}
