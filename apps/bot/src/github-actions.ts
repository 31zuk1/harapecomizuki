import type { DeploymentStatus, ResolvedConfig } from './types';

interface WorkflowRun {
  id: number;
  name: string;
  html_url: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
}

interface WorkflowRunsResponse {
  workflow_runs: WorkflowRun[];
}

function parseRepo(fullName: string): { owner: string; repo: string } | null {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWorkflowRuns(config: ResolvedConfig): Promise<WorkflowRun[]> {
  if (!config.githubRepo || !config.githubToken) {
    return [];
  }

  const parsedRepo = parseRepo(config.githubRepo);
  if (!parsedRepo) {
    throw new Error(`GITHUB_REPO は owner/repo 形式で指定してください: ${config.githubRepo}`);
  }

  const response = await fetch(
    `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/actions/runs?per_page=20&event=push`,
    {
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'discord-blog-poc'
      }
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub Actions API ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as WorkflowRunsResponse;
  return payload.workflow_runs;
}

function mapRunToDeploymentStatus(run: WorkflowRun, commitSha: string): DeploymentStatus {
  const checkedAt = new Date().toISOString();

  if (run.status === 'completed') {
    if (run.conclusion === 'success') {
      return {
        state: 'success',
        checkedAt,
        commitSha,
        workflowName: run.name,
        workflowRunId: run.id,
        workflowRunUrl: run.html_url,
        detail: 'GitHub Pages deploy が完了しています。'
      };
    }

    return {
      state: 'failed',
      checkedAt,
      commitSha,
      workflowName: run.name,
      workflowRunId: run.id,
      workflowRunUrl: run.html_url,
      detail: `workflow conclusion: ${run.conclusion ?? 'unknown'}`
    };
  }

  return {
    state: run.status === 'in_progress' ? 'in_progress' : 'queued',
    checkedAt,
    commitSha,
    workflowName: run.name,
    workflowRunId: run.id,
    workflowRunUrl: run.html_url,
    detail: `workflow status: ${run.status}`
  };
}

export async function trackDeploymentStatus(
  config: ResolvedConfig,
  commitSha: string,
  attempts = 5,
  delayMs = 1500
): Promise<DeploymentStatus> {
  const checkedAt = new Date().toISOString();

  if (!commitSha) {
    return {
      state: 'not_applicable',
      checkedAt,
      detail: 'commit SHA がないため deploy 状態を確認できません。'
    };
  }

  if (!config.githubRepo || !config.githubToken) {
    return {
      state: 'not_configured',
      checkedAt,
      commitSha,
      detail: 'GITHUB_REPO または GITHUB_TOKEN が未設定のため deploy 状態を追跡できません。'
    };
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const workflowRuns = await fetchWorkflowRuns(config);
      const matchingRun = workflowRuns.find(
        (run) =>
          run.head_sha === commitSha &&
          (!config.githubPagesWorkflowName || run.name === config.githubPagesWorkflowName)
      );

      if (matchingRun) {
        return mapRunToDeploymentStatus(matchingRun, commitSha);
      }
    } catch (error) {
      return {
        state: 'unknown',
        checkedAt: new Date().toISOString(),
        commitSha,
        detail: error instanceof Error ? error.message : 'GitHub Actions の状態確認に失敗しました。'
      };
    }

    if (attempt < attempts - 1) {
      await wait(delayMs);
    }
  }

  return {
    state: 'queued',
    checkedAt: new Date().toISOString(),
    commitSha,
    workflowName: config.githubPagesWorkflowName ?? null,
    detail: 'workflow run はまだ見つかっていません。push 直後の可能性があります。'
  };
}
