import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBlogCommandService } from '../src/command-service';
import { resolveAppConfig } from '../src/config';
import { BlogRepository } from '../src/content-service';
import { parsePostCommand } from '../src/post-parser';
import type { IncomingMessage, ResolvedConfig } from '../src/types';

function createIncomingMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    messageId: 'message-1',
    channelId: 'blog-channel',
    content:
      '!post\ntitle: Hello from Discord\nslug: hello-from-discord\ntags: discord, astro\n\nBody from Discord.\n',
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

describe('blog flow', () => {
  let tempRoot = '';
  let attachmentPath = '';
  let config: ResolvedConfig;
  let repository: BlogRepository;
  let service: ReturnType<typeof createBlogCommandService>;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'discord-blog-poc-'));
    attachmentPath = path.join(tempRoot, 'hero.svg');
    await writeFile(
      attachmentPath,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#f97316"/></svg>',
      'utf8'
    );

    config = resolveAppConfig(
      {
        BLOG_REPO_ROOT: tempRoot,
        BLOG_CHANNEL_ID: 'blog-channel',
        PUBLISHER_ROLE_ID: 'publisher',
        SITE_BASE_URL: 'https://example.com'
      },
      tempRoot
    );
    repository = new BlogRepository(config);
    service = createBlogCommandService(config);
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('parses !post payloads', () => {
    const payload = parsePostCommand(
      '!post\ntitle: Sample\nslug: sample\ntags: one, two\n\nParagraph one.\n\nParagraph two.'
    );

    expect(payload).toEqual({
      title: 'Sample',
      slug: 'sample',
      tags: ['one', 'two'],
      body: 'Paragraph one.\n\nParagraph two.'
    });
  });

  it('creates a draft markdown file, registry entry, and uploaded attachment', async () => {
    const response = await service.handleIncomingMessage(
      createIncomingMessage({
        attachments: [
          {
            name: 'hero.svg',
            sourcePath: attachmentPath,
            contentType: 'image/svg+xml'
          }
        ]
      })
    );

    expect(response?.ok).toBe(true);
    expect(response?.slug).toBe('hello-from-discord');

    const draftFile = path.join(tempRoot, 'content', 'drafts', 'hello-from-discord.md');
    const draftMarkdown = await readFile(draftFile, 'utf8');
    expect(draftMarkdown).toContain('title: "Hello from Discord"');
    expect(draftMarkdown).toContain('![hero.svg](https://example.com/uploads/2026/04/');

    const registryRaw = await readFile(path.join(tempRoot, 'data', 'posts.json'), 'utf8');
    expect(registryRaw).toContain('"slug": "hello-from-discord"');
  });

  it('keeps the published snapshot frozen until the next publish', async () => {
    await service.handleIncomingMessage(
      createIncomingMessage({
        attachments: [
          {
            name: 'hero.svg',
            sourcePath: attachmentPath,
            contentType: 'image/svg+xml'
          }
        ]
      })
    );

    await service.handleIncomingMessage({
      messageId: 'command-1',
      channelId: 'blog-channel',
      content: '!publish hello-from-discord',
      actor: {
        id: 'publisher-1',
        name: 'Publisher',
        roles: ['publisher']
      },
      attachments: [],
      createdAt: '2026-04-01T01:30:00.000Z',
      updatedAt: '2026-04-01T01:30:00.000Z'
    });

    const publishedFile = path.join(tempRoot, 'apps', 'site', 'src', 'posts', 'hello-from-discord.md');
    const firstPublished = await readFile(publishedFile, 'utf8');
    expect(firstPublished).toContain('Body from Discord.');

    await service.handleMessageEdit(
      createIncomingMessage({
        content:
          '!post\ntitle: Hello from Discord\ntags: discord, astro, edited\n\nDraft changed after publish.',
        updatedAt: '2026-04-01T02:00:00.000Z',
        attachments: [
          {
            name: 'hero.svg',
            sourcePath: attachmentPath,
            contentType: 'image/svg+xml'
          }
        ]
      })
    );

    const updatedDraft = await readFile(path.join(tempRoot, 'content', 'drafts', 'hello-from-discord.md'), 'utf8');
    const frozenPublished = await readFile(publishedFile, 'utf8');
    const post = await repository.findBySlug('hello-from-discord');

    expect(updatedDraft).toContain('Draft changed after publish.');
    expect(frozenPublished).toContain('Body from Discord.');
    expect(frozenPublished).not.toContain('Draft changed after publish.');
    expect(post?.hasUnpublishedChanges).toBe(true);
  });

  it('rejects publish without the configured publisher role', async () => {
    await service.handleIncomingMessage(createIncomingMessage());

    const response = await service.handleIncomingMessage({
      messageId: 'command-2',
      channelId: 'blog-channel',
      content: '!publish hello-from-discord',
      actor: {
        id: 'viewer-1',
        name: 'Viewer',
        roles: []
      },
      attachments: [],
      createdAt: '2026-04-01T01:30:00.000Z',
      updatedAt: '2026-04-01T01:30:00.000Z'
    });

    expect(response).toEqual({
      ok: false,
      message: 'publish 権限がありません。'
    });
  });

  it('returns preview and status details for tracked posts', async () => {
    await service.handleIncomingMessage(createIncomingMessage());

    const preview = await service.handleIncomingMessage({
      messageId: 'command-3',
      channelId: 'blog-channel',
      content: '!preview hello-from-discord',
      actor: {
        id: 'viewer-1',
        name: 'Viewer',
        roles: []
      },
      attachments: [],
      createdAt: '2026-04-01T01:10:00.000Z',
      updatedAt: '2026-04-01T01:10:00.000Z'
    });

    expect(preview?.ok).toBe(true);
    expect(preview?.message).toContain('draft preview:');
    expect(preview?.message).toContain('Body from Discord.');

    await service.handleIncomingMessage({
      messageId: 'command-4',
      channelId: 'blog-channel',
      content: '!publish hello-from-discord',
      actor: {
        id: 'publisher-1',
        name: 'Publisher',
        roles: ['publisher']
      },
      attachments: [],
      createdAt: '2026-04-01T01:30:00.000Z',
      updatedAt: '2026-04-01T01:30:00.000Z'
    });

    const status = await service.handleIncomingMessage({
      messageId: 'command-5',
      channelId: 'blog-channel',
      content: '!status hello-from-discord',
      actor: {
        id: 'viewer-1',
        name: 'Viewer',
        roles: []
      },
      attachments: [],
      createdAt: '2026-04-01T01:31:00.000Z',
      updatedAt: '2026-04-01T01:31:00.000Z'
    });

    expect(status?.ok).toBe(true);
    expect(status?.message).toContain('status: published');
    expect(status?.message).toContain('deploy: 不明');
    expect(status?.message).toContain('live: https://example.com/posts/hello-from-discord/');
  });
});
