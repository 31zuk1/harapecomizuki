import { BlogRepository } from './content-service';
import { JobQueue } from './job-queue';
import { parseCommand } from './post-parser';
import type { CommandResponse, IncomingMessage, ResolvedConfig } from './types';

const SHORT_HELP_TEXT = [
  'Discord Blog Beta commands:',
  '`!post`  下書きを作成 / 更新',
  '`!publish <slug>`  現在の draft を公開スナップショット化',
  '`!republish <slug>`  公開中記事を最新 draft で再反映',
  '`!unpublish <slug>`  公開を外して draft を保持',
  '`!status <slug>`  draft / publish / deploy 状態を確認',
  '`!preview <slug>`  draft の要約を確認',
  '`!drafts [limit]`  未公開 or 未反映 draft 一覧',
  '`!recent [limit]`  最近更新された投稿一覧',
  '`!cleanup-uploads`  orphan uploads を掃除',
  '`!help all`  詳細ヘルプ'
].join('\n');

const FULL_HELP_TEXT = [
  'Discord Blog Beta detailed help',
  '',
  '`!post` format:',
  '```text',
  '!post',
  'title: タイトル',
  'slug: optional',
  'tags: a, b',
  '',
  '本文...',
  '```',
  '',
  '`!publish <slug>`',
  '  現在の draft を published snapshot に更新します。',
  '`!republish <slug>`',
  '  公開中記事を最新 draft で再反映します。',
  '`!status <slug>`',
  '  draft / sync / git / deploy / live URL を表示します。',
  '`!preview <slug>`',
  '  draft の本文先頭、タグ、添付数を表示します。',
  '`!drafts [limit]`',
  '  未公開または未反映の投稿を新しい順に表示します。',
  '`!recent [limit]`',
  '  最近更新された投稿を新しい順に表示します。',
  '`!cleanup-uploads`',
  '  現在参照されていない upload を削除します。publisher 権限が必要です。'
].join('\n');

function canPublish(config: ResolvedConfig, roles: string[]): boolean {
  if (!config.publisherRoleId) {
    return true;
  }

  return roles.includes(config.publisherRoleId);
}

export class BlogCommandService {
  private readonly queue = new JobQueue();

  constructor(
    private readonly config: ResolvedConfig,
    private readonly repository: BlogRepository
  ) {}

  private async safely<T extends CommandResponse | null>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '処理に失敗しました。'
      } as T;
    }
  }

  private async runQueued(task: () => Promise<CommandResponse>): Promise<CommandResponse> {
    return this.queue.run(task);
  }

  async handleIncomingMessage(input: IncomingMessage): Promise<CommandResponse | null> {
    if (input.channelId !== this.config.blogChannelId) {
      return null;
    }

    const command = parseCommand(input.content);

    return this.safely(async () => {
      switch (command.kind) {
        case 'ignored':
          return null;
        case 'error':
          return { ok: false, message: command.message };
        case 'help':
          return { ok: true, message: command.verbose ? FULL_HELP_TEXT : SHORT_HELP_TEXT };
        case 'status':
          return this.repository.status(command.slug);
        case 'preview':
          return this.repository.preview(command.slug);
        case 'drafts':
          return this.repository.listDrafts(command.limit);
        case 'recent':
          return this.repository.listRecent(command.limit);
        case 'publish':
          if (!canPublish(this.config, input.actor.roles)) {
            return { ok: false, message: 'publish 権限がありません。' };
          }

          return this.runQueued(() => this.repository.publish(command.slug, 'publish'));
        case 'republish':
          if (!canPublish(this.config, input.actor.roles)) {
            return { ok: false, message: 'republish 権限がありません。' };
          }

          return this.runQueued(() => this.repository.publish(command.slug, 'republish'));
        case 'unpublish':
          if (!canPublish(this.config, input.actor.roles)) {
            return { ok: false, message: 'unpublish 権限がありません。' };
          }

          return this.runQueued(() => this.repository.unpublish(command.slug));
        case 'cleanupUploads':
          if (!canPublish(this.config, input.actor.roles)) {
            return { ok: false, message: 'cleanup 権限がありません。' };
          }

          return this.runQueued(() => this.repository.cleanupOrphanUploads());
        case 'post':
          return this.runQueued(() => this.repository.upsertDraft(input));
        default:
          return null;
      }
    });
  }

  async handleMessageEdit(input: IncomingMessage): Promise<CommandResponse | null> {
    if (input.channelId !== this.config.blogChannelId) {
      return null;
    }

    return this.safely(async () => {
      const trackedPost = await this.repository.findByMessageId(input.messageId);
      if (!trackedPost) {
        return null;
      }

      const command = parseCommand(input.content);
      if (command.kind !== 'post') {
        return {
          ok: false,
          message: `追跡中の投稿 \`${trackedPost.slug}\` は \`!post\` 形式を維持してください。既存の draft は変更していません。`
        };
      }

      return this.runQueued(() => this.repository.upsertDraft(input));
    });
  }
}

export function createBlogCommandService(config: ResolvedConfig) {
  return new BlogCommandService(config, new BlogRepository(config));
}
