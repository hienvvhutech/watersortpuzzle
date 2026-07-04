import { IErrorService } from '../domain/repositories/IErrorService';

/**
 * Concrete implementation of IErrorService using console logs.
 * Ready to be swapped with Firebase Crashlytics for release.
 */
export class ConsoleErrorService implements IErrorService {
  logError(error: Error, context?: string): void {
    console.error(`[ErrorService] Error in context (${context || 'unknown'}): ${error.message}`, error.stack);
  }

  logBreadcrumb(message: string): void {
    console.info(`[ErrorService] Breadcrumb: ${message}`);
  }
}
