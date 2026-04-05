import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type {
  GitAutomationErrorCode,
  GitAutomationResult,
  GitAutomationStepResult,
  ResolvedConfig
} from './types';

interface GitCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runGit(args: string[], cwd: string, extraEnv?: Record<string, string | undefined>): GitCommandResult {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  return {
    status: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim()
  };
}

function createStep(
  step: GitAutomationStepResult['step'],
  ok: boolean,
  code: GitAutomationStepResult['code'],
  summary: string,
  detail?: string | null
): GitAutomationStepResult {
  return {
    step,
    ok,
    code,
    summary,
    detail: detail ?? null
  };
}

function baseResult(overrides: Partial<GitAutomationResult> = {}): GitAutomationResult {
  return {
    status: 'disabled',
    steps: [],
    happenedAt: new Date().toISOString(),
    ...overrides
  };
}

function failedResult(
  errorCode: GitAutomationErrorCode,
  step: GitAutomationStepResult,
  overrides: Partial<GitAutomationResult> = {}
): GitAutomationResult {
  return {
    ...baseResult(overrides),
    status: 'failed',
    errorCode,
    errorMessage: step.detail ?? step.summary,
    steps: [...(overrides.steps ?? []), step]
  };
}

function detectPushFailureCode(stderr: string): GitAutomationErrorCode {
  const normalized = stderr.toLowerCase();

  if (
    normalized.includes('authentication failed') ||
    normalized.includes('could not read username') ||
    normalized.includes('permission denied') ||
    normalized.includes('repository not found')
  ) {
    return 'auth_failed';
  }

  if (
    normalized.includes('non-fast-forward') ||
    normalized.includes('fetch first') ||
    normalized.includes('[rejected]') ||
    normalized.includes('failed to push some refs')
  ) {
    return 'push_rejected';
  }

  return 'push_failed';
}

function getHeadCommitSha(repoRoot: string): string | null {
  const result = runGit(['rev-parse', 'HEAD'], repoRoot);
  return result.status === 0 ? result.stdout || null : null;
}

function hasUpstreamBranch(repoRoot: string): boolean {
  const result = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repoRoot);
  return result.status === 0;
}

export function isGitRepository(repoRoot: string): boolean {
  const result = runGit(['rev-parse', '--is-inside-work-tree'], repoRoot);
  return result.status === 0;
}

export function getCurrentBranch(repoRoot: string): string | null {
  const result = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  return result.status === 0 ? result.stdout || null : null;
}

export function getOriginRemoteUrl(repoRoot: string): string | null {
  const result = runGit(['remote', 'get-url', 'origin'], repoRoot);
  return result.status === 0 ? result.stdout || null : null;
}

export function getFileLastCommit(repoRoot: string, relativeFilePath: string): string | null {
  const result = runGit(['log', '-1', '--format=%H', '--', relativeFilePath], repoRoot);
  return result.status === 0 ? result.stdout || null : null;
}

export function maybeRunGitAutomation(
  config: ResolvedConfig,
  absolutePaths: string[],
  commitMessage: string
): GitAutomationResult {
  const branch = getCurrentBranch(config.repoRoot);
  const remote = getOriginRemoteUrl(config.repoRoot);
  const steps: GitAutomationStepResult[] = [];

  if (!config.gitAutoCommit && !config.gitAutoPush) {
    return baseResult({
      status: 'disabled',
      errorCode: 'disabled',
      errorMessage: 'git automation は無効です。',
      branch,
      remote
    });
  }

  if (config.gitAutoPush && !config.gitAutoCommit) {
    return failedResult(
      'auto_commit_required',
      createStep(
        'precheck',
        false,
        'auto_commit_required',
        'GIT_AUTO_PUSH を使うには GIT_AUTO_COMMIT=true が必要です。'
      ),
      { branch, remote, steps }
    );
  }

  if (!isGitRepository(config.repoRoot)) {
    return failedResult(
      'not_a_repo',
      createStep('precheck', false, 'not_a_repo', 'git repository ではないため自動化を実行できません。'),
      { branch, remote, steps }
    );
  }

  if (config.gitAutoPush && !remote) {
    return failedResult(
      'no_remote',
      createStep('precheck', false, 'no_remote', 'origin remote が見つからないため push できません。'),
      { branch, remote, steps }
    );
  }

  steps.push(createStep('precheck', true, 'ok', 'git automation の前提条件を確認しました。'));

  const relativePaths = [...new Set(absolutePaths.map((absolutePath) => path.relative(config.repoRoot, absolutePath)))];
  const addResult = runGit(['add', ...relativePaths], config.repoRoot);
  if (addResult.status !== 0) {
    return failedResult(
      'add_failed',
      createStep('add', false, 'add_failed', 'git add に失敗しました。', addResult.stderr || addResult.stdout),
      { branch, remote, steps }
    );
  }

  steps.push(createStep('add', true, 'ok', '変更をステージしました。'));

  const diffResult = runGit(['diff', '--cached', '--quiet'], config.repoRoot);
  if (diffResult.status === 0) {
    return {
      ...baseResult({
        status: 'no_changes',
        branch,
        remote,
        steps: [...steps, createStep('commit', true, 'no_changes', 'コミット対象の差分はありません。')]
      }),
      errorCode: 'no_changes',
      errorMessage: 'コミット対象の差分はありません。'
    };
  }

  const commitEnv = {
    GIT_AUTHOR_NAME: config.gitAuthorName,
    GIT_AUTHOR_EMAIL: config.gitAuthorEmail,
    GIT_COMMITTER_NAME: config.gitAuthorName,
    GIT_COMMITTER_EMAIL: config.gitAuthorEmail
  };
  const commitResult = runGit(['commit', '-m', commitMessage], config.repoRoot, commitEnv);
  if (commitResult.status !== 0) {
    return failedResult(
      'commit_failed',
      createStep('commit', false, 'commit_failed', 'git commit に失敗しました。', commitResult.stderr || commitResult.stdout),
      { branch, remote, steps }
    );
  }

  const commitSha = getHeadCommitSha(config.repoRoot);
  steps.push(
    createStep('commit', true, 'ok', `コミットを作成しました。${commitSha ? ` (${commitSha.slice(0, 7)})` : ''}`)
  );

  if (!config.gitAutoPush) {
    return {
      ...baseResult({
        status: 'committed',
        branch,
        remote,
        commitSha,
        steps
      })
    };
  }

  const hadUpstream = hasUpstreamBranch(config.repoRoot);
  const pushArgs = hadUpstream
    ? ['push']
    : ['push', '--set-upstream', 'origin', branch && branch !== 'HEAD' ? branch : 'HEAD'];
  const pushResult = runGit(pushArgs, config.repoRoot);
  if (pushResult.status !== 0) {
    const errorCode = detectPushFailureCode(pushResult.stderr || pushResult.stdout);
    return failedResult(
      errorCode,
      createStep('push', false, errorCode, 'git push に失敗しました。', pushResult.stderr || pushResult.stdout),
      { branch, remote, commitSha, steps }
    );
  }

  steps.push(
    createStep(
      'push',
      true,
      'ok',
      hadUpstream ? 'origin へ push しました。' : 'origin へ push し、upstream を設定しました。'
    )
  );

  return {
    ...baseResult({
      status: 'pushed',
      branch,
      remote,
      commitSha,
      steps
    })
  };
}
