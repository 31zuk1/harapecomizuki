import { promises as fs } from 'node:fs';
import path from 'node:path';
import { maybeRunGitAutomation } from './git';
import { parsePostCommand } from './post-parser';
import type {
  CommandResponse,
  IncomingAttachment,
  IncomingMessage,
  RegistryPost,
  ResolvedConfig,
  StoredAttachment
} from './types';
import {
  ensureTrailingSlash,
  ensureDir,
  fileExists,
  isImageAttachment,
  readRegistryFile,
  renderFrontmatter,
  sanitizeFileName,
  slugify,
  toPosix,
  writeRegistryFile
} from './utils';

function relativeToRepo(config: ResolvedConfig, absolutePath: string): string {
  return toPosix(path.relative(config.repoRoot, absolutePath));
}

function compactDateSeed(value: string): string {
  return value.replace(/[-:.TZ]/g, '').slice(0, 14);
}

function renderAttachmentMarkdown(attachments: StoredAttachment[]): string {
  if (attachments.length === 0) {
    return '';
  }

  const blocks = attachments.map((attachment) => {
    if (isImageAttachment(attachment.originalName, attachment.contentType)) {
      return `![${attachment.originalName}](${attachment.publicUrl})`;
    }

    return `- [${attachment.originalName}](${attachment.publicUrl})`;
  });

  return `\n\n## Attachments\n\n${blocks.join('\n\n')}\n`;
}

function buildMarkdown(post: RegistryPost, publishedAtOverride?: string | null, hasUnpublishedChanges?: boolean): string {
  const frontmatter = renderFrontmatter({
    title: post.title,
    tags: post.tags,
    authorName: post.authorName,
    authorId: post.authorId,
    sourceMessageId: post.messageId,
    sourceChannelId: post.channelId,
    status: post.status,
    hasUnpublishedChanges: hasUnpublishedChanges ?? post.hasUnpublishedChanges,
    draftUpdatedAt: post.updatedAt,
    publishedAt: publishedAtOverride ?? post.publishedAt,
    attachments: post.attachments.map((attachment) => attachment.publicUrl)
  });

  return `${frontmatter}${post.body.trim()}${renderAttachmentMarkdown(post.attachments)}`;
}

async function persistAttachment(
  config: ResolvedConfig,
  attachment: IncomingAttachment,
  messageId: string,
  updatedAt: string
): Promise<StoredAttachment> {
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
      status: nextStatus,
      hasUnpublishedChanges,
      attachments,
      draftFilePath: relativeToRepo(this.config, draftFilePath),
      publishedFilePath: relativeToRepo(this.config, publishedFilePath),
      createdAt: existingPost?.createdAt ?? input.createdAt,
      updatedAt: input.updatedAt,
      publishedAt: existingPost?.publishedAt ?? null
    };

    await fs.writeFile(draftFilePath, buildMarkdown(nextPost), 'utf8');
    registry.posts[input.messageId] = nextPost;
    await this.writeRegistry(registry);
    maybeRunGitAutomation(
      this.config,
      [
        this.config.registryFile,
        draftFilePath,
        ...attachments.map((attachment) => path.join(this.config.siteDir, 'public', attachment.storedRelativePath))
      ],
      `chore(blog): sync draft ${slug}`
    );

    return {
      ok: true,
      message: existingPost
        ? `Draft を更新しました: \`${slug}\`${nextStatus === 'published' ? ' (公開中の記事にはまだ反映されていません)' : ''}`
        : `Draft を作成しました: \`${slug}\``,
      slug
    };
  }

  async publish(slug: string): Promise<CommandResponse> {
    const registry = await this.readRegistry();
    const post = Object.values(registry.posts).find((item) => item.slug === slug);

    if (!post) {
      return {
        ok: false,
        message: `slug \`${slug}\` の投稿が見つかりません。`
      };
    }

    const publishedAt = new Date().toISOString();
    const publishedFilePath = path.join(this.config.repoRoot, post.publishedFilePath);
    const draftFilePath = path.join(this.config.repoRoot, post.draftFilePath);
    const publishedPost: RegistryPost = {
      ...post,
      status: 'published',
      hasUnpublishedChanges: false,
      publishedAt
    };

    await fs.writeFile(publishedFilePath, buildMarkdown(publishedPost, publishedAt, false), 'utf8');
    await fs.writeFile(draftFilePath, buildMarkdown(publishedPost, publishedAt, false), 'utf8');
    registry.posts[post.messageId] = publishedPost;
    await this.writeRegistry(registry);
    maybeRunGitAutomation(
      this.config,
      [this.config.registryFile, publishedFilePath, draftFilePath],
      `chore(blog): publish ${slug}`
    );

    return {
      ok: true,
      message: `\`${slug}\` を公開しました。${this.config.siteBaseUrl.replace(/\/$/, '')}/posts/${slug}/`
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
    await fs.rm(publishedFilePath, { force: true });

    const unpublishedPost: RegistryPost = {
      ...post,
      status: 'unpublished',
      hasUnpublishedChanges: true,
      publishedAt: null
    };

    await fs.writeFile(draftFilePath, buildMarkdown(unpublishedPost), 'utf8');
    registry.posts[post.messageId] = unpublishedPost;
    await this.writeRegistry(registry);
    maybeRunGitAutomation(
      this.config,
      [this.config.registryFile, draftFilePath, publishedFilePath],
      `chore(blog): unpublish ${slug}`
    );

    return {
      ok: true,
      message: `\`${slug}\` を非公開にしました。下書きは保持されています。`
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

    const liveUrl =
      post.status === 'published' ? `${this.config.siteBaseUrl.replace(/\/$/, '')}/posts/${post.slug}/` : '未公開';
    const syncState =
      post.status === 'published' && post.hasUnpublishedChanges
        ? '公開中のスナップショットより新しい draft があります'
        : post.status === 'published'
          ? 'draft と公開中の内容は同期済みです'
          : '公開ファイルは存在しません';

    return {
      ok: true,
      message: [
        `slug: \`${post.slug}\``,
        `status: ${post.status}`,
        `title: ${post.title}`,
        `updatedAt: ${post.updatedAt}`,
        `publishedAt: ${post.publishedAt ?? '未公開'}`,
        `sync: ${syncState}`,
        `draft: \`${post.draftFilePath}\``,
        `live: ${liveUrl}`
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
