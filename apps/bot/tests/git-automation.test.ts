import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBlogCommandService } from '../src/command-service';
import { resolveAppConfig } from '../src/config';
import { maybeRunGitAutomation } from '../src/git';
import type { IncomingMessage, ResolvedConfig } from '../src/types';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8'
  }).trim();
}

function createIncomingMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    messageId: 'message-1',
    channelId: 'blog-channel',
    content: '!post\ntitle: Git Test\nslug: git-test\n\nBody from Discord.\n',
    actor: {
      id: 'author-1',
      name: 'Author',
      roles: []
    },
    attachments: [],
    createdAt: '2026-04-01T01:00:00.000Z',
    updatedAt: '2026-04-01T01:00:00.000Z',
    ...overrides
  };
}

function createConfig(tempRoot: string, overrides: Record<string, string> = {}): ResolvedConfig {
  return resolveAppConfig(
    {
      BLOG_REPO_ROOT: tempRoot,
      BLOG_CHANNEL_ID: 'blog-channel',
      GIT_AUTHOR_NAME: 'Discord Blog Bot',
      GIT_AUTHOR_EMAIL: 'bot@example.com',
      ...overrides
    },
    tempRoot
  );
}

async function initGitRepo(tempRoot: string): Promise<void> {
  git(['init', '-b', 'main'], tempRoot);
}

describe('git automation', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'discord-blog-git-'));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('creates a local commit when auto commit is enabled', async () => {
    await initGitRepo(tempRoot);
    const config = createConfig(tempRoot, {
      GIT_AUTO_COMMIT: 'true',
      GIT_AUTO_PUSH: 'false'
    });
    const filePath = path.join(tempRoot, 'note.txt');
    await writeFile(filePath, 'hello\n', 'utf8');

    const result = maybeRunGitAutomation(config, [filePath], 'test: local commit');

    expect(result.status).toBe('committed');
    expect(result.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(result.steps.map((step) => step.step)).toEqual(['precheck', 'add', 'commit']);
    expect(git(['log', '--format=%s', '-1'], tempRoot)).toBe('test: local commit');
  });

  it('pushes and sets upstream when auto push is enabled', async () => {
    const remoteRoot = await mkdtemp(path.join(os.tmpdir(), 'discord-blog-git-remote-'));
    try {
      await initGitRepo(tempRoot);
      git(['init', '--bare', remoteRoot], tempRoot);
      git(['remote', 'add', 'origin', remoteRoot], tempRoot);

      const config = createConfig(tempRoot, {
        GIT_AUTO_COMMIT: 'true',
        GIT_AUTO_PUSH: 'true'
      });
      const filePath = path.join(tempRoot, 'note.txt');
      await writeFile(filePath, 'hello\n', 'utf8');

      const result = maybeRunGitAutomation(config, [filePath], 'test: push commit');

      expect(result.status).toBe('pushed');
      expect(result.commitSha).toMatch(/^[a-f0-9]{40}$/);
      expect(git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], tempRoot)).toBe('origin/main');
      expect(git(['rev-parse', 'refs/remotes/origin/main'], tempRoot)).toBe(result.commitSha);
    } finally {
      await rm(remoteRoot, { recursive: true, force: true });
    }
  });

  it('surfaces push failures in the user-facing response', async () => {
    await initGitRepo(tempRoot);
    git(['remote', 'add', 'origin', path.join(tempRoot, 'missing-remote.git')], tempRoot);

    const config = createConfig(tempRoot, {
      GIT_AUTO_COMMIT: 'true',
      GIT_AUTO_PUSH: 'true'
    });
    const service = createBlogCommandService(config);

    const response = await service.handleIncomingMessage(createIncomingMessage());

    expect(response?.ok).toBe(true);
    expect(response?.message).toContain('Draft を作成しました');
    expect(response?.message).toContain('git:');
    expect(response?.message).toContain('失敗');
  });
});
