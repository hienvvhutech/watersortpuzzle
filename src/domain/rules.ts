import { Move } from './types';

export const TUBE_CAPACITY = 4;

/**
 * Gets the top color and count of consecutive layers of that color in a tube.
 */
export function getTopColorSegment(tube: string[]): { color: string; count: number } | null {
  if (tube.length === 0) return null;
  const color = tube[tube.length - 1];
  let count = 0;
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === color) {
      count++;
    } else {
      break;
    }
  }
  return { color, count };
}

/**
 * Checks if a move from one tube to another is valid.
 */
export function isValidMove(
  tubes: string[][],
  fromIdx: number,
  toIdx: number,
  capacity: number = TUBE_CAPACITY
): boolean {
  // Check bounds
  if (fromIdx < 0 || fromIdx >= tubes.length || toIdx < 0 || toIdx >= tubes.length) {
    return false;
  }
  if (fromIdx === toIdx) return false;

  const source = tubes[fromIdx];
  const dest = tubes[toIdx];

  // Source must not be empty
  if (source.length === 0) return false;

  // Destination must not be full
  if (dest.length >= capacity) return false;

  const topSource = getTopColorSegment(source);
  if (!topSource) return false;

  // If destination is empty, the move is always valid
  if (dest.length === 0) {
    // Optimization/Rule: Avoid pouring a complete single color tube into another empty tube
    // because it doesn't change the game state meaningfully, just moves the tube.
    // However, for basic rules, it is technically valid. We allow it, but solver will filter it.
    return true;
  }

  // Destination top color must match source top color
  const topDestColor = dest[dest.length - 1];
  return topSource.color === topDestColor;
}

/**
 * Executes a move, returning the new tubes state and details of the move.
 * Assumes the move is already verified as valid via isValidMove.
 */
export function executeMove(
  tubes: string[][],
  fromIdx: number,
  toIdx: number,
  capacity: number = TUBE_CAPACITY
): { tubes: string[][]; move: Move } {
  // Create deep copy of tubes
  const newTubes = tubes.map((t) => [...t]);
  const source = newTubes[fromIdx];
  const dest = newTubes[toIdx];

  const topSource = getTopColorSegment(source)!;
  const destRemainingSpace = capacity - dest.length;
  
  // Amount to pour is the minimum of what source has at top and what dest can hold
  const amountToPour = Math.min(topSource.count, destRemainingSpace);

  // Transfer the colors
  for (let i = 0; i < amountToPour; i++) {
    source.pop();
    dest.push(topSource.color);
  }

  const move: Move = {
    fromTubeIndex: fromIdx,
    toTubeIndex: toIdx,
    color: topSource.color,
    amount: amountToPour,
  };

  return { tubes: newTubes, move };
}

/**
 * Checks if the game is won.
 * Game is won if every tube is either empty OR full and contains only one color.
 */
export function checkWinCondition(tubes: string[][], capacity: number = TUBE_CAPACITY): boolean {
  for (const tube of tubes) {
    if (tube.length === 0) continue;
    if (tube.length !== capacity) return false;
    
    // Check if all elements are the same color
    const firstColor = tube[0];
    for (const color of tube) {
      if (color !== firstColor) return false;
    }
  }
  return true;
}
