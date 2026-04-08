import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolve the repository root directory.
 *
 * Priority:
 * 1. REPO_ROOT env var (set by Helmfile in K8s to /workspace)
 * 2. Walk up from cwd looking for .git or .the-dev-team
 * 3. Fall back to cwd
 *
 * Cached after first call.
 */
let _cachedRoot: string | null = null;

export function getRepoRoot(): string {
  if (_cachedRoot) return _cachedRoot;

  // K8s: REPO_ROOT is always set via configmap
  if (process.env.REPO_ROOT) {
    _cachedRoot = process.env.REPO_ROOT;
    return _cachedRoot;
  }

  // Local dev: walk up from cwd
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    try {
      if (
        fs.existsSync(path.join(dir, '.the-dev-team')) ||
        fs.existsSync(path.join(dir, '.git'))
      ) {
        _cachedRoot = dir;
        return dir;
      }
    } catch {
      break; // Permission denied — stop walking
    }
    dir = path.dirname(dir);
  }

  _cachedRoot = process.cwd();
  return _cachedRoot;
}
