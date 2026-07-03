import { Move, HistoryEntry } from './types';
import { isValidMove, executeMove, checkWinCondition, getTopColorSegment, TUBE_CAPACITY } from './rules';

interface QueueNode {
  tubes: string[][];
  moves: Move[];
}

/**
 * Serializes a tube array to a normalized string representation.
 * Since tubes are interchangeable, we sort the string representations
 * of individual tubes to detect isomorphic states.
 */
export function serializeState(tubes: string[][]): string {
  return tubes
    .map((tube) => tube.join(','))
    .sort()
    .join('|');
}

/**
 * Solves the Water Sort game from the given tubes state using BFS.
 * Returns an array of Moves to solve the level, or null if unsolvable.
 * 
 * Max iterations capped to prevent infinite loops / lag.
 */
export function solve(
  initialTubes: string[][],
  capacity: number = TUBE_CAPACITY,
  maxIterations: number = 8000
): Move[] | null {
  // If already won, return empty moves
  if (checkWinCondition(initialTubes, capacity)) {
    return [];
  }

  const queue: QueueNode[] = [{ tubes: initialTubes, moves: [] }];
  const visited = new Set<string>();
  visited.add(serializeState(initialTubes));

  let iterations = 0;

  while (queue.length > 0) {
    iterations++;
    if (iterations > maxIterations) {
      return null; // Search space too large or unsolvable within limits
    }

    const currentNode = queue.shift();
    if (!currentNode) break;

    const { tubes, moves } = currentNode;

    // Generate all valid moves from this state
    for (let i = 0; i < tubes.length; i++) {
      const source = tubes[i];
      if (source.length === 0) continue;

      // Optimization: Do not move from a completed tube
      const sourceTop = getTopColorSegment(source);
      if (source.length === capacity && sourceTop && sourceTop.count === capacity) {
        continue;
      }

      for (let j = 0; j < tubes.length; j++) {
        if (i === j) continue;

        if (isValidMove(tubes, i, j, capacity)) {
          // Optimization: Avoid pouring a single-color stack into an empty tube
          // as it is equivalent to the current state (only swapped tube positions)
          if (tubes[j].length === 0 && sourceTop && sourceTop.count === source.length) {
            continue;
          }

          const { tubes: nextTubes, move } = executeMove(tubes, i, j, capacity);
          
          if (checkWinCondition(nextTubes, capacity)) {
            return [...moves, move];
          }

          const stateHash = serializeState(nextTubes);
          if (!visited.has(stateHash)) {
            visited.add(stateHash);
            queue.push({
              tubes: nextTubes,
              moves: [...moves, move],
            });
          }
        }
      }
    }
  }

  return null; // Unsolvable
}

/**
 * Gets the next best move (hint) for the current state.
 */
export function getNextHint(
  currentTubes: string[][],
  capacity: number = TUBE_CAPACITY
): Move | null {
  const solution = solve(currentTubes, capacity, 4000);
  if (solution && solution.length > 0) {
    return solution[0];
  }
  return null;
}
