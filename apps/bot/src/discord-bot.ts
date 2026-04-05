import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type Message,
  type PartialMessage
} from 'discord.js';
import type { CommandResponse, IncomingAttachment, IncomingMessage, ResolvedConfig } from './types';
import { createBlogCommandService } from './command-service';

function toIncomingAttachments(message: Message<boolean>): IncomingAttachment[] {
  return [...message.attachments.values()].map((attachment) => ({
    name: attachment.name ?? 'attachment',
    url: attachment.url,
    contentType: attachment.contentType,
    size: attachment.size
  }));
}

function toIncomingMessage(message: Message<boolean>): IncomingMessage {
  return {
    messageId: message.id,
    channelId: message.channelId,
    content: message.content,
    actor: {
      id: message.author.id,
      name: message.member?.displayName ?? message.author.displayName ?? message.author.username,
      roles: message.member?.roles.cache.map((role) => role.id) ?? [],
      avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 128 })
    },
    attachments: toIncomingAttachments(message),
    createdAt: message.createdAt.toISOString(),
    updatedAt: (message.editedAt ?? message.createdAt).toISOString()
  };
}

async function hydrateMessage(message: Message<boolean> | PartialMessage): Promise<Message<boolean> | null> {
  if ('partial' in message && message.partial) {
    try {
      return await message.fetch();
    } catch {
      return null;
    }
  }

  return message as Message<boolean>;
}

async function replyIfNeeded(message: Message<boolean>, response: CommandResponse | null) {
  if (!response) {
    return;
  }

  const prefix = response.ok ? 'OK' : 'NG';
  await message.reply(`${prefix}\n${response.message}`);
}

export async function startDiscordBot(config: ResolvedConfig): Promise<void> {
  if (!config.discordToken) {
    throw new Error('DISCORD_TOKEN が設定されていません。');
  }

  const service = createBlogCommandService(config);
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Discord bot ready: ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.channel.type !== ChannelType.GuildText) {
      return;
    }

    const response = await service.handleIncomingMessage(toIncomingMessage(message));
    await replyIfNeeded(message, response);
  });

  client.on(Events.MessageUpdate, async (_previous, nextMessage) => {
    const hydrated = await hydrateMessage(nextMessage);

    if (!hydrated || hydrated.author.bot || hydrated.channel.type !== ChannelType.GuildText) {
      return;
    }

    const response = await service.handleMessageEdit(toIncomingMessage(hydrated));
    await replyIfNeeded(hydrated, response);
  });

  await client.login(config.discordToken);
}
