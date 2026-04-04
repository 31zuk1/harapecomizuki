import { BlogRepository } from './content-service';
import { parseCommand } from './post-parser';
import type { CommandResponse, IncomingMessage, ResolvedConfig } from './types';

const HELP_TEXT = [
  'Discord Blog PoC commands:',
  '`!post`',
  '  title / slug / tags と本文を含むメッセージを draft 化します',
  '`!publish <slug>`',
  '  現在の draft を published スナップショットとして反映します',
  '`!unpublish <slug>`',
  '  公開ファイルを外して draft だけ残します',
  '`!status <slug>`',
  '  draft と published の状態を確認します',
  '`!help`',
  '  このヘルプを表示します'
].join('\n');

function canPublish(config: ResolvedConfig, roles: string[]): boolean {
  if (!config.publisherRoleId) {
    return true;
  }

  return roles.includes(config.publisherRoleId);
}

export class BlogCommandService {
  constructor(
    private readonly config: ResolvedConfig,
    private readonly repository: BlogRepository
  ) {}

  async handleIncomingMessage(input: IncomingMessage): Promise<CommandResponse | null> {
    if (input.channelId !== this.config.blogChannelId) {
      return null;
    }

    const command = parseCommand(input.content);

    switch (command.kind) {
      case 'ignored':
        return null;
      case 'error':
        return { ok: false, message: command.message };
      case 'help':
        return { ok: true, message: HELP_TEXT };
      case 'status':
        return this.repository.status(command.slug);
      case 'publish':
        if (!canPublish(this.config, input.actor.roles)) {
          return { ok: false, message: 'publish 権限がありません。' };
        }

        return this.repository.publish(command.slug);
      case 'unpublish':
        if (!canPublish(this.config, input.actor.roles)) {
          return { ok: false, message: 'unpublish 権限がありません。' };
        }

        return this.repository.unpublish(command.slug);
      case 'post':
        return this.repository.upsertDraft(input);
      default:
        return null;
    }
  }

  async handleMessageEdit(input: IncomingMessage): Promise<CommandResponse | null> {
    if (input.channelId !== this.config.blogChannelId) {
      return null;
    }

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

    return this.repository.upsertDraft(input);
  }
}

export function createBlogCommandService(config: ResolvedConfig) {
  return new BlogCommandService(config, new BlogRepository(config));
}
