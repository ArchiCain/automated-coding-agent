/**
 * Per-file async locking — serializes concurrent writes to the same file.
 * Ported from Pi tools. Different file paths run in parallel;
 * same file path operations serialize.
 */

import * as path from 'path';

const fileMutationQueues = new Map<string, Promise<void>>();

function getMutationQueueKey(filePath: string): string {
  return path.resolve(filePath);
}

/**
 * Wrap an async operation with per-file serialization.
 * Operations on the same file path will execute sequentially.
 * Operations on different paths run in parallel.
 */
export async function withFileMutationQueue<T>(
  filePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = getMutationQueueKey(filePath);
  const currentQueue = fileMutationQueues.get(key) ?? Promise.resolve();

  let resolveNext: () => void;
  const nextQueue = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });

  // Chain: wait for current, then run our op, then signal next
  const chainedQueue = currentQueue.then(() => nextQueue);
  fileMutationQueues.set(key, chainedQueue);

  // Wait for previous operations on this file to complete
  await currentQueue;

  try {
    return await fn();
  } finally {
    resolveNext!();
    // Clean up if we're the last in the chain
    if (fileMutationQueues.get(key) === chainedQueue) {
      fileMutationQueues.delete(key);
    }
  }
}
