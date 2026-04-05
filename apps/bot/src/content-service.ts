import { promises as fs } from 'node:fs';
import path from 'node:path';
import { trackDeploymentStatus } from './github-actions';
import { getFileLastCommit, maybeRunGitAutomation } from './git';
import {
  buildMarkdown,
  buildPublicPostUrl,
  deploymentLabel,
  deploymentSummaryLines,
  gitSummaryLines,
  summarizeBody
} from './post-output';
import { parsePostCommand } from './post-parser';
import type {
  CommandResponse,
  DeploymentStatus,
  GitAutomationResult,
  IncomingAttachment,
  IncomingMessage,
  PostStatus,
  RegistryPost,
  ResolvedConfig,
  StoredAttachment
} from './types';
import {
  ensureTrailingSlash,
  ensureDir,
  fileExists,
  readRegistryFile,
  sanitizeFileName,
  slugify,
  toPosix,
  writeRegistryFile
} from './utils';

const DEFAULT_LIST_LIMIT = 5;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.md',
  '.pdf',
  '.png',
  '.svg',
  '.txt',
  '.webp'
]);
const ALLOWED_ATTACHMENT_MIME_PREFIXES = ['image/', 'text/plain', 'text/markdown', 'application/pdf'];

function relativeToRepo(config: ResolvedConfig, absolutePath: string): string {
  return toPosix(path.relative(config.repoRoot, absolutePath));
}

function compactDateSeed(value: string): string {
  return value.replace(/[-:.TZ]/g, '').slice(0, 14);
}

function getPublishedAttachments(post: RegistryPost): StoredAttachment[] {
  return post.publishedAttachments ?? [];
}

function isAllowedAttachment(attachment: IncomingAttachment): boolean {
  const normalizedContentType = attachment.contentType?.split(';')[0]?.trim().toLowerCase() ?? null;
  const extension = path.extname(attachment.name).toLowerCase();

  if (normalizedContentType && ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) => normalizedContentType.startsWith(prefix))) {
    return true;
  }

  return ALLOWED_ATTACHMENT_EXTENSIONS.has(extension);
}

function validateAttachment(config: ResolvedConfig, attachment: IncomingAttachment): void {
  if (attachment.size && attachment.size > config.attachmentMaxSizeBytes) {
    throw new Error(
      `添付ファイル ${attachment.name} はサイズ上限を超えています。${Math.round(config.attachmentMaxSizeBytes / 1024 / 1024)}MB 以下にしてください。`
    );
  }

  if (!isAllowedAttachment(attachment)) {
    throw new Error(
      `添付ファイル ${attachment.name} は許可されていない形式です。画像または pdf / txt / md を使ってください。`
    );
  }
}

function sortPostsByUpdatedAt(posts: RegistryPost[]): RegistryPost[] {
  return [...posts].sort((left, right) => {
    const leftTime = new Date(left.updatedAt).getTime();
    const rightTime = new Date(right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

async function persistAttachment(
  config: ResolvedConfig,
  attachment: IncomingAttachment,
  messageId: string,
  updatedAt: string
): Promise<StoredAttachment> {
  validateAttachment(config, attachment);

  const timestamp = new Date(updatedAt);
  const year = String(timestamp.getUTCFullYear());
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
  const targetDir = path.join(config.uploadsDir, year, month);
  await ensureDir(targetDir);

  const safeName = sanitizeFileName(attachment.name);
  const fileName = `${messageId}-${compactDateSeed(updatedAt)}-${safeName}`;
  const targetPath = path.join(targetDir, fileName);

  if (attachment.sourcePath) {
    await fs.copyFile(attachment.sourcePath, targetPath);
  } else if (attachment.url) {
    const response = await fetch(attachment.url);

    if (!response.ok) {
      throw new Error(`添付ファイルの取得に失敗しました: ${attachment.url}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(targetPath, bytes);
  } else {
    throw new Error(`添付ファイル ${attachment.name} に URL も sourcePath もありません。`);
  }

  const storedRelativePath = toPosix(path.join('uploads', year, month, fileName));
  const publicUrl = new URL(storedRelativePath, ensureTrailingSlash(config.siteBaseUrl)).toString();
  return {
    originalName: attachment.name,
    storedRelativePath,
    publicUrl,
    contentType: attachment.contentType ?? null
  };
}

async function removeStoredAttachments(config: ResolvedConfig, attachments: StoredAttachment[]): Promise<void> {
  await Promise.all(
    attachments.map((attachment) =>
      fs.rm(path.join(config.siteDir, 'public', attachment.storedRelativePath), { force: true }).catch(() => undefined)
    )
  );
}

async function listFilesRecursively(targetDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) => {
        const absolutePath = path.join(targetDir, entry.name);
        return entry.isDirectory() ? listFilesRecursively(absolutePath) : [absolutePath];
      })
    );

    return nested.flat();
  } catch {
    return [];
  }
}

export class BlogRepository {
  constructor(private readonly config: ResolvedConfig) {}

  async initialize(): Promise<void> {
    await Promise.all([
      ensureDir(this.config.draftsDir),
      ensureDir(this.config.publishedDir),
      ensureDir(this.config.uploadsDir),
      ensureDir(path.dirname(this.config.registryFile))
    ]);

    if (!(await fileExists(this.config.registryFile))) {
      await writeRegistryFile(this.config.registryFile, { posts: {} });
    }
  }

  private async readRegistry() {
    await this.initialize();
    return readRegistryFile(this.config.registryFile);
  }

  private async writeRegistry(registry: { posts: Record<string, RegistryPost> }): Promise<void> {
    await writeRegistryFile(this.config.registryFile, registry);
  }

  async findByMessageId(messageId: string): Promise<RegistryPost | undefined> {
    const registry = await this.readRegistry();
    return registry.posts[messageId];
  }

  async findBySlug(slug: string): Promise<RegistryPost | undefined> {
    const registry = await this.readRegistry();
    return Object.values(registry.posts).find((post) => post.slug === slug);
  }

  async listPosts(): Promise<RegistryPost[]> {
    const registry = await this.readRegistry();
    return sortPostsByUpdatedAt(Object.values(registry.posts));
  }

  private createUniqueSlug(registry: { posts: Record<string, RegistryPost> }, desiredSlug: string, messageId: string): string {
    const existingPosts = Object.values(registry.posts);
    let candidate = desiredSlug;
    let suffix = 2;

    while (existingPosts.some((post) => post.slug === candidate && post.messageId !== messageId)) {
      candidate = `${desiredSlug}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private async resolveDeploymentForPost(post: RegistryPost, attempts = 1): Promise<DeploymentStatus | null> {
    if (post.status !== 'published') {
      return {
        state: 'not_applicable',
        checkedAt: new Date().toISOString(),
        detail: '未公開のため deploy 状態はありません。'
      };
    }

    if (!post.publishedFilePath) {
      return null;
    }

    const commitSha = getFileLastCommit(this.config.repoRoot, post.publishedFilePath);
    if (!commitSha) {
      return {
        state: 'unknown',
        checkedAt: new Date().toISOString(),
        detail: '公開ファイルの commit SHA を取得できませんでした。'
      };
    }

    return trackDeploymentStatus(this.config, commitSha, attempts, 1200);
  }

  private buildDraftResponseMessage(baseMessage: string, gitResult: GitAutomationResult): string {
    const lines = [baseMessage, ...gitSummaryLines(gitResult)];
    return lines.join('\n');
  }

  async upsertDraft(input: IncomingMessage): Promise<CommandResponse> {
    const payload = parsePostCommand(input.content);
    const registry = await this.readRegistry();
    const existingPost = registry.posts[input.messageId];
    const baseSlug = existingPost?.slug ?? slugify(payload.slug ?? payload.title, compactDateSeed(input.createdAt));
    const slug = this.createUniqueSlug(registry, baseSlug, input.messageId);
    const attachments = await Promise.all(
      input.attachments.map((attachment) => persistAttachment(this.config, attachment, input.messageId, input.updatedAt))
    );
    const draftFilePath = path.join(this.config.draftsDir, `${slug}.md`);
    const publishedFilePath = path.join(this.config.publishedDir, `${slug}.md`);
    const publishedAttachments =
      existingPost?.status === 'published'
        ? existingPost.publishedAttachments ?? existingPost.attachments
        : existingPost?.publishedAttachments ?? [];

    if (existingPost && existingPost.slug !== slug) {
      const previousDraftPath = path.join(this.config.draftsDir, `${existingPost.slug}.md`);
      if (await fileExists(previousDraftPath)) {
        await fs.rm(previousDraftPath, { force: true });
      }
    }

    const nextStatus = existingPost?.status ?? 'draft';
    const hasUnpublishedChanges = true;
    const nextPost: RegistryPost = {
      messageId: input.messageId,
      channelId: input.channelId,
      slug,
      title: payload.title,
      tags: payload.tags,
      body: payload.body,
      authorId: input.actor.id,
      authorName: input.actor.name,
      authorAvatarUrl: input.actor.avatarUrl ?? existingPost?.authorAvatarUrl ?? null,
      status: nextStatus,
      hasUnpublishedChanges,
      attachments,
      publishedAttachments,
      draftFilePath: relativeToRepo(this.config, draftFilePath),
      publishedFilePath: relativeToRepo(this.config, publishedFilePath),
      createdAt: existingPost?.createdAt ?? input.createdAt,
      updatedAt: input.updatedAt,
      publishedAt: existingPost?.publishedAt ?? null
    };

    await fs.writeFile(draftFilePath, buildMarkdown(nextPost), 'utf8');
    registry.posts[input.messageId] = nextPost;
    await this.writeRegistry(registry);

    const keepRelativePaths = new Set([
      ...attachments.map((attachment) => attachment.storedRelativePath),
      ...publishedAttachments.map((attachment) => attachment.storedRelativePath)
    ]);
    const removableAttachments = (existingPost?.attachments ?? []).filter(
      (attachment) => !keepRelativePaths.has(attachment.storedRelativePath)
    );
    await removeStoredAttachments(this.config, removableAttachments);

    const gitResult = maybeRunGitAutomation(
      this.config,
      [
        this.config.registryFile,
        draftFilePath,
        ...attachments.map((attachment) => path.join(this.config.siteDir, 'public', attachment.storedRelativePath)),
        ...removableAttachments.map((attachment) => path.join(this.config.siteDir, 'public', attachment.storedRelativePath))
      ],
      `chore(blog): sync draft ${slug}`
    );

    return {
      ok: true,
      message: this.buildDraftResponseMessage(
        existingPost
          ? `Draft を更新しました: \`${slug}\`${nextStatus === 'published' ? ' (公開中の記事にはまだ反映されていません)' : ''}`
          : `Draft を作成しました: \`${slug}\``,
        gitResult
      ),
      slug
    };
  }

  async publish(slug: string, mode: 'publish' | 'republish' = 'publish'): Promise<CommandResponse> {
    const registry = await this.readRegistry();
    const post = Object.values(registry.posts).find((item) => item.slug === slug);

    if (!post) {
      return {
        ok: false,
        message: `slug \`${slug}\` の投稿が見つかりません。`
      };
    }

    const previousPublishedAttachments = getPublishedAttachments(post);
    const publishedAttachments = post.attachments;
    const publishedAt = new Date().toISOString();
    const publishedFilePath = path.join(this.config.repoRoot, post.publishedFilePath);
    const draftFilePath = path.join(this.config.repoRoot, post.draftFilePath);
    const publishedPost: RegistryPost = {
      ...post,
      status: 'published',
      hasUnpublishedChanges: false,
      publishedAt,
      publishedAttachments
    };

    await fs.writeFile(
      publishedFilePath,
      buildMarkdown(publishedPost, {
        publishedAtOverride: publishedAt,
        hasUnpublishedChanges: false,
        attachmentsOverride: publishedAttachments,
        statusOverride: 'published'
      }),
      'utf8'
    );
    await fs.writeFile(
      draftFilePath,
      buildMarkdown(publishedPost, {
        publishedAtOverride: publishedAt,
        hasUnpublishedChanges: false,
        attachmentsOverride: publishedAttachments,
        statusOverride: 'published'
      }),
      'utf8'
    );
    registry.posts[post.messageId] = publishedPost;
    await this.writeRegistry(registry);

    const removableAttachments = previousPublishedAttachments.filter(
      (attachment) => !publishedAttachments.some((candidate) => candidate.storedRelativePath === attachment.storedRelativePath)
    );
    await removeStoredAttachments(this.config, removableAttachments);

    const gitResult = maybeRunGitAutomation(
      this.config,
      [
        this.config.registryFile,
        publishedFilePath,
        draftFilePath,
        ...publishedAttachments.map((attachment) => path.join(this.config.siteDir, 'public', attachment.storedRelativePath)),
        ...removableAttachments.map((attachment) => path.join(this.config.siteDir, 'public', attachment.storedRelativePath))
      ],
      `chore(blog): publish ${slug}`
    );

    const publicUrl = buildPublicPostUrl(this.config, slug);
    const deploymentStatus =
      gitResult.status === 'pushed' && gitResult.commitSha
        ? await trackDeploymentStatus(this.config, gitResult.commitSha, 3, 1000)
        : gitResult.status === 'committed'
          ? {
              state: 'not_applicable' as const,
              checkedAt: new Date().toISOString(),
              commitSha: gitResult.commitSha,
              detail: 'ローカル commit までは完了しています。公開には push が必要です。'
            }
          : gitResult.status === 'disabled'
            ? {
                state: 'not_applicable' as const,
                checkedAt: new Date().toISOString(),
                detail: 'git automation は無効です。手動で commit / push してください。'
              }
            : null;

    const headline =
      mode === 'republish' || post.status === 'published'
        ? `\`${slug}\` の公開スナップショットを更新しました。`
        : `\`${slug}\` を公開しました。`;

    return {
      ok: true,
      message: [headline, ...gitSummaryLines(gitResult), ...deploymentSummaryLines(deploymentStatus), `live: ${publicUrl}`].join(
        '\n'
      )
    };
  }

  async unpublish(slug: string): Promise<CommandResponse> {
    const registry = await this.readRegistry();
    const post = Object.values(registry.posts).find((item) => item.slug === slug);

    if (!post) {
      return {
        ok: false,
        message: `slug \`${slug}\` の投稿が見つかりません。`
      };
    }

    const publishedFilePath = path.join(this.config.repoRoot, post.publishedFilePath);
    const draftFilePath = path.join(this.config.repoRoot, post.draftFilePath);
    const publishedAttachments = getPublishedAttachments(post);
    await fs.rm(publishedFilePath, { force: true });

    const unpublishedPost: RegistryPost = {
      ...post,
      status: 'unpublished',
      hasUnpublishedChanges: true,
      publishedAt: null,
      publishedAttachments: []
    };

    await fs.writeFile(
      draftFilePath,
      buildMarkdown(unpublishedPost, {
        attachmentsOverride: unpublishedPost.attachments,
        statusOverride: 'unpublished'
      }),
      'utf8'
    );
    registry.posts[post.messageId] = unpublishedPost;
    await this.writeRegistry(registry);

    const removableAttachments = publishedAttachments.filter(
      (attachment) => !unpublishedPost.attachments.some((candidate) => candidate.storedRelativePath === attachment.storedRelativePath)
    );
    await removeStoredAttachments(this.config, removableAttachments);

    const gitResult = maybeRunGitAutomation(
      this.config,
      [
        this.config.registryFile,
        draftFilePath,
        publishedFilePath,
        ...unpublishedPost.attachments.map((attachment) =>
          path.join(this.config.siteDir, 'public', attachment.storedRelativePath)
        ),
        ...removableAttachments.map((attachment) => path.join(this.config.siteDir, 'public', attachment.storedRelativePath))
      ],
      `chore(blog): unpublish ${slug}`
    );

    const deploymentStatus =
      gitResult.status === 'pushed' && gitResult.commitSha
        ? await trackDeploymentStatus(this.config, gitResult.commitSha, 3, 1000)
        : gitResult.status === 'committed'
          ? {
              state: 'not_applicable' as const,
              checkedAt: new Date().toISOString(),
              commitSha: gitResult.commitSha,
              detail: 'ローカル commit までは完了しています。公開サイトから消すには push が必要です。'
            }
          : null;

    return {
      ok: true,
      message: [
        `\`${slug}\` を非公開にしました。下書きは保持されています。`,
        ...gitSummaryLines(gitResult),
        ...deploymentSummaryLines(deploymentStatus)
      ].join('\n')
    };
  }

  async status(slug: string): Promise<CommandResponse> {
    const post = await this.findBySlug(slug);

    if (!post) {
      return {
        ok: false,
        message: `slug \`${slug}\` の投稿が見つかりません。`
      };
    }

    const trackedFile = post.status === 'published' ? post.publishedFilePath : post.draftFilePath;
    const lastCommit = getFileLastCommit(this.config.repoRoot, trackedFile);
    const deploymentStatus = await this.resolveDeploymentForPost(post, 1);
    const liveUrl = post.status === 'published' ? buildPublicPostUrl(this.config, post.slug) : '未公開';
    const syncState =
      post.status === 'published' && post.hasUnpublishedChanges
        ? '公開中のスナップショットより新しい draft があります'
        : post.status === 'published'
          ? 'draft と公開中の内容は同期済みです'
          : '公開ファイルは存在しません';
    const attachmentSummary =
      post.status === 'published' && post.hasUnpublishedChanges
        ? `attachments: draft=${post.attachments.length}, published=${getPublishedAttachments(post).length}`
        : `attachments: ${post.attachments.length}`;

    return {
      ok: true,
      message: [
        `slug: \`${post.slug}\``,
        `status: ${post.status}`,
        `title: ${post.title}`,
        `updatedAt: ${post.updatedAt}`,
        `publishedAt: ${post.publishedAt ?? '未公開'}`,
        `sync: ${syncState}`,
        attachmentSummary,
        `lastCommit: ${lastCommit ? `\`${lastCommit.slice(0, 7)}\`` : '未記録'}`,
        deploymentLabel(
          deploymentStatus ?? {
            state: 'unknown',
            checkedAt: new Date().toISOString(),
            detail: 'deploy 状態は確認できませんでした。'
          }
        ),
        ...(deploymentStatus?.workflowRunUrl ? [`deployRun: ${deploymentStatus.workflowRunUrl}`] : []),
        ...(deploymentStatus?.detail ? [`deployDetail: ${deploymentStatus.detail}`] : []),
        `draft: \`${post.draftFilePath}\``,
        `live: ${liveUrl}`
      ].join('\n')
    };
  }

  async preview(slug: string): Promise<CommandResponse> {
    const post = await this.findBySlug(slug);

    if (!post) {
      return {
        ok: false,
        message: `slug \`${slug}\` の投稿が見つかりません。`
      };
    }

    return {
      ok: true,
      message: [
        `slug: \`${post.slug}\``,
        `status: ${post.status}`,
        `title: ${post.title}`,
        `tags: ${post.tags.length > 0 ? post.tags.join(', ') : 'なし'}`,
        `attachments: ${post.attachments.length}`,
        'draft preview:',
        summarizeBody(post.body),
        post.status === 'published' ? `live: ${buildPublicPostUrl(this.config, post.slug)}` : 'live: 未公開'
      ].join('\n')
    };
  }

  async listDrafts(limit = DEFAULT_LIST_LIMIT): Promise<CommandResponse> {
    const posts = await this.listPosts();
    const drafts = posts.filter((post) => post.status !== 'published' || post.hasUnpublishedChanges).slice(0, limit);

    if (drafts.length === 0) {
      return {
        ok: true,
        message: '未公開または未反映の draft はありません。'
      };
    }

    return {
      ok: true,
      message: ['drafts:', ...drafts.map((post) => `- \`${post.slug}\` [${post.status}] ${post.title} (${post.updatedAt})`)].join(
        '\n'
      )
    };
  }

  async listRecent(limit = DEFAULT_LIST_LIMIT): Promise<CommandResponse> {
    const posts = (await this.listPosts()).slice(0, limit);

    if (posts.length === 0) {
      return {
        ok: true,
        message: '投稿はまだありません。'
      };
    }

    return {
      ok: true,
      message: ['recent:', ...posts.map((post) => `- \`${post.slug}\` [${post.status}] ${post.title} (${post.updatedAt})`)].join(
        '\n'
      )
    };
  }

  async cleanupOrphanUploads(): Promise<CommandResponse> {
    const registry = await this.readRegistry();
    const referenced = new Set<string>();

    for (const post of Object.values(registry.posts)) {
      for (const attachment of post.attachments) {
        referenced.add(path.join(this.config.siteDir, 'public', attachment.storedRelativePath));
      }

      for (const attachment of getPublishedAttachments(post)) {
        referenced.add(path.join(this.config.siteDir, 'public', attachment.storedRelativePath));
      }
    }

    const uploadFiles = await listFilesRecursively(this.config.uploadsDir);
    const orphanedFiles = uploadFiles.filter((filePath) => !referenced.has(filePath));
    await Promise.all(orphanedFiles.map((filePath) => fs.rm(filePath, { force: true })));

    const gitResult = maybeRunGitAutomation(
      this.config,
      orphanedFiles,
      `chore(blog): cleanup orphan uploads (${orphanedFiles.length})`
    );

    return {
      ok: true,
      message: [
        `orphan uploads を掃除しました。removed=${orphanedFiles.length} kept=${uploadFiles.length - orphanedFiles.length}`,
        ...gitSummaryLines(gitResult)
      ].join('\n')
    };
  }

  async resetAllContent(): Promise<void> {
    await this.initialize();

    await Promise.all([
      fs.rm(this.config.draftsDir, { recursive: true, force: true }),
      fs.rm(this.config.publishedDir, { recursive: true, force: true }),
      fs.rm(this.config.uploadsDir, { recursive: true, force: true })
    ]);

    await this.initialize();
    await writeRegistryFile(this.config.registryFile, { posts: {} });
  }
}
