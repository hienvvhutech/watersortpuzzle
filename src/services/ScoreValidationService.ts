import { Difficulty } from '../domain/types';

export interface ScoreDetails {
  levelId: number;
  score: number;
  coins: number;
  bestTime: number;
  difficulty: Difficulty;
  movesCount?: number;
}

export const ScoreValidationService = {
  /**
   * Performs client-side structural validation of the player's score update.
   * Ready to be swapped with a fetch call to Cloud Functions or an ASP.NET Core API in the future.
   */
  validateScore: async (details: ScoreDetails): Promise<boolean> => {
    // 1. Basic boundary checks
    if (details.levelId < 0) return false;
    if (details.score < 0) return false;
    if (details.coins < 0) return false;
    if (details.bestTime < 0) return false;

    // 2. Structural sanity checks
    // An average level requires at least 2 seconds to solve
    if (details.bestTime > 0 && details.bestTime < 2) {
      console.warn('[ScoreValidationService] Flagged impossible completion time:', details.bestTime);
      return false;
    }

    // 3. Move count checks
    if (details.movesCount !== undefined && details.movesCount <= 0) {
      return false;
    }

    // Future extension: API request to ASP.NET Core or Firebase Cloud Functions
    // const res = await fetch('https://api.domain.com/scores/validate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(details) });
    // return res.ok;

    return true;
  }
};
