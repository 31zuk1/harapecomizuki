import type { ParsedCommand, PostPayload } from './types';

function parseTags(rawTags: string | undefined): string[] {
  if (!rawTags) {
    return [];
  }

  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parsePostCommand(content: string): PostPayload {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines[0]?.trim() !== '!post') {
    throw new Error('`!post` で始まるメッセージだけを下書き化できます。');
  }

  let index = 1;
  const metadata = new Map<string, string>();

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      break;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error('メタデータは `key: value` 形式で指定してください。');
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    metadata.set(key, value);
    index += 1;
  }

  const title = metadata.get('title');
  const body = lines.slice(index).join('\n').trim();

  if (!title) {
    throw new Error('`title:` は必須です。');
  }

  if (!body) {
    throw new Error('本文が空です。空行のあとに本文を書いてください。');
  }

  return {
    title,
    slug: metadata.get('slug') || undefined,
    tags: parseTags(metadata.get('tags')),
    body
  };
}

function parseSlugCommand(kind: 'publish' | 'unpublish' | 'status', content: string): ParsedCommand {
  const parts = content.trim().split(/\s+/);
  const slug = parts[1];

  if (!slug) {
    return {
      kind: 'error',
      message: `\`!${kind} <slug>\` の形式で指定してください。`
    };
  }

  return { kind, slug };
}

export function parseCommand(content: string): ParsedCommand {
  const trimmed = content.trim();

  if (!trimmed.startsWith('!')) {
    return { kind: 'ignored' };
  }

  if (trimmed === '!help') {
    return { kind: 'help' };
  }

  if (trimmed.startsWith('!publish')) {
    return parseSlugCommand('publish', trimmed);
  }

  if (trimmed.startsWith('!unpublish')) {
    return parseSlugCommand('unpublish', trimmed);
  }

  if (trimmed.startsWith('!status')) {
    return parseSlugCommand('status', trimmed);
  }

  if (trimmed.startsWith('!post')) {
    try {
      return {
        kind: 'post',
        payload: parsePostCommand(content)
      };
    } catch (error) {
      return {
        kind: 'error',
        message: error instanceof Error ? error.message : '投稿の解析に失敗しました。'
      };
    }
  }

  return { kind: 'ignored' };
}
