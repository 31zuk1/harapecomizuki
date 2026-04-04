import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { ResolvedConfig } from './types';

function runGit(args: string[], cwd: string, extraEnv?: Record<string, string | undefined>) {
  return spawnSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      ...extraEnv
    }
  });
}

export function isGitRepository(repoRoot: string): boolean {
  const result = runGit(['rev-parse', '--is-inside-work-tree'], repoRoot);
  return result.status === 0;
}

export function maybeRunGitAutomation(
  config: ResolvedConfig,
  absolutePaths: string[],
  commitMessage: string
): void {
  if (!config.gitAutoCommit && !config.gitAutoPush) {
    return;
  }

  if (!isGitRepository(config.repoRoot) || !config.gitAutoCommit) {
    return;
  }

  const relativePaths = absolutePaths.map((absolutePath) => path.relative(config.repoRoot, absolutePath));
  const addResult = runGit(['add', ...relativePaths], config.repoRoot);

  if (addResult.status !== 0) {
    return;
  }

  const diffResult = runGit(['diff', '--cached', '--quiet'], config.repoRoot);
  if (diffResult.status === 0) {
    return;
  }

  const commitEnv = {
    GIT_AUTHOR_NAME: config.gitAuthorName,
    GIT_AUTHOR_EMAIL: config.gitAuthorEmail,
    GIT_COMMITTER_NAME: config.gitAuthorName,
    GIT_COMMITTER_EMAIL: config.gitAuthorEmail
  };
  const commitResult = runGit(['commit', '-m', commitMessage], config.repoRoot, commitEnv);

  if (commitResult.status !== 0 || !config.gitAutoPush) {
    return;
  }

  runGit(['push'], config.repoRoot);
}
