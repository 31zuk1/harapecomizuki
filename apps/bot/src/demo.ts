import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createBlogCommandService } from './command-service';
import { resolveAppConfig } from './config';
import { BlogRepository } from './content-service';
import type { CommandActor, IncomingAttachment, IncomingMessage } from './types';

interface DemoFixture {
  messageId: string;
  channelId?: string;
  content: string;
  author: {
    id: string;
    name: string;
    roles?: string[];
  };
  attachments?: Array<{
    name: string;
    sourcePath: string;
    contentType?: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

function defaultPublisher(config: ReturnType<typeof resolveAppConfig>): CommandActor {
  return {
    id: 'demo-publisher',
    name: 'Demo Publisher',
    roles: config.publisherRoleId ? [config.publisherRoleId] : []
  };
}

function defaultAuthor(fixture: DemoFixture): CommandActor {
  return {
    id: fixture.author.id,
    name: fixture.author.name,
    roles: fixture.author.roles ?? []
  };
}

function toIncomingMessage(
  config: ReturnType<typeof resolveAppConfig>,
  fixture: DemoFixture,
  repoRoot: string
): IncomingMessage {
  const attachments: IncomingAttachment[] = (fixture.attachments ?? []).map((attachment) => ({
    name: attachment.name,
    sourcePath: path.isAbsolute(attachment.sourcePath)
      ? attachment.sourcePath
      : path.join(repoRoot, attachment.sourcePath),
    contentType: attachment.contentType ?? null
  }));

  const createdAt = fixture.createdAt ?? new Date().toISOString();
  return {
    messageId: fixture.messageId,
    channelId: fixture.channelId ?? config.blogChannelId,
    content: fixture.content,
    actor: defaultAuthor(fixture),
    attachments,
    createdAt,
    updatedAt: fixture.updatedAt ?? createdAt
  };
}

async function loadFixture(fixturePath: string): Promise<DemoFixture> {
  const raw = await fs.readFile(fixturePath, 'utf8');
  return JSON.parse(raw) as DemoFixture;
}

async function runFixtureCommand(
  service: ReturnType<typeof createBlogCommandService>,
  config: ReturnType<typeof resolveAppConfig>,
  repoRoot: string,
  fixturePath: string,
  edited = false
): Promise<void> {
  const fixture = await loadFixture(fixturePath);
  const input = toIncomingMessage(config, fixture, repoRoot);
  const response = edited ? await service.handleMessageEdit(input) : await service.handleIncomingMessage(input);
  console.log(response?.message ?? 'No response');
}

async function main(): Promise<void> {
  const currentWorkingDir = process.cwd();
  const config = resolveAppConfig(
    {
      ...process.env,
      BLOG_CHANNEL_ID: process.env.BLOG_CHANNEL_ID ?? 'demo-blog-channel',
      PUBLISHER_ROLE_ID: process.env.PUBLISHER_ROLE_ID ?? 'demo-publisher',
      SITE_BASE_URL: process.env.SITE_BASE_URL ?? 'http://localhost:4321'
    },
    currentWorkingDir
  );
  const repoRoot = config.repoRoot;
  const repository = new BlogRepository(config);
  const service = createBlogCommandService(config);
  const [command = 'scenario', argument] = process.argv.slice(2);

  switch (command) {
    case 'reset':
      await repository.resetAllContent();
      console.log('Demo state reset');
      return;
    case 'post':
      await runFixtureCommand(
        service,
        config,
        repoRoot,
        argument ?? path.join(repoRoot, 'demo', 'fixtures', 'post-create.json')
      );
      return;
    case 'edit':
      await runFixtureCommand(
        service,
        config,
        repoRoot,
        argument ?? path.join(repoRoot, 'demo', 'fixtures', 'post-edit.json'),
        true
      );
      return;
    case 'publish': {
      const slug = argument ?? 'hello-from-discord';
      const response = await service.handleIncomingMessage({
        messageId: `demo-publish-${Date.now()}`,
        channelId: config.blogChannelId,
        content: `!publish ${slug}`,
        actor: defaultPublisher(config),
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(response?.message ?? 'No response');
      return;
    }
    case 'unpublish': {
      const slug = argument ?? 'hello-from-discord';
      const response = await service.handleIncomingMessage({
        messageId: `demo-unpublish-${Date.now()}`,
        channelId: config.blogChannelId,
        content: `!unpublish ${slug}`,
        actor: defaultPublisher(config),
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(response?.message ?? 'No response');
      return;
    }
    case 'status': {
      const slug = argument ?? 'hello-from-discord';
      const response = await service.handleIncomingMessage({
        messageId: `demo-status-${Date.now()}`,
        channelId: config.blogChannelId,
        content: `!status ${slug}`,
        actor: defaultPublisher(config),
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(response?.message ?? 'No response');
      return;
    }
    case 'help': {
      const response = await service.handleIncomingMessage({
        messageId: `demo-help-${Date.now()}`,
        channelId: config.blogChannelId,
        content: '!help',
        actor: defaultPublisher(config),
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(response?.message ?? 'No response');
      return;
    }
    case 'scenario':
    default:
      await repository.resetAllContent();
      await runFixtureCommand(service, config, repoRoot, path.join(repoRoot, 'demo', 'fixtures', 'post-create.json'));
      await runFixtureCommand(
        service,
        config,
        repoRoot,
        path.join(repoRoot, 'demo', 'fixtures', 'post-edit.json'),
        true
      );

      const publishResponse = await service.handleIncomingMessage({
        messageId: `demo-publish-${Date.now()}`,
        channelId: config.blogChannelId,
        content: '!publish hello-from-discord',
        actor: defaultPublisher(config),
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(publishResponse?.message ?? 'No response');

      const statusResponse = await service.handleIncomingMessage({
        messageId: `demo-status-${Date.now()}`,
        channelId: config.blogChannelId,
        content: '!status hello-from-discord',
        actor: defaultPublisher(config),
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('\nStatus');
      console.log(statusResponse?.message ?? 'No response');
      console.log('\nNext step: npm run build && npm run dev');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
