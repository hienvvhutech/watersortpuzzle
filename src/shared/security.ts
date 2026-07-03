/**
 * Computes a simple cryptographic checksum hash of a string using a secret salt.
 * Used for verifying game state integrity and preventing local save editing.
 */
export function computeHash(data: string, salt: string = 'water-sort-puzzle-salt-2026'): string {
  let hash1 = 5381;
  let hash2 = 52711;
  const combined = data + salt;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }
  
  return (hash1 >>> 0).toString(16) + (hash2 >>> 0).toString(16);
}

/**
 * Checks if the system time has been altered to cheat daily rewards or energy.
 * Prevents Time Cheat by comparing local timestamps with a saved maximum timestamp.
 */
export function verifyTimeIntegrity(currentTimestamp: number, savedMaxTimestamp: number): boolean {
  // If the current time is before the maximum saved time, the clock has been set back.
  if (currentTimestamp < savedMaxTimestamp) {
    return false;
  }
  return true;
}
