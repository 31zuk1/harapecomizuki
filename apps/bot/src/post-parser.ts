import type { ParsedCommand, PostPayload } from './types';

const DEFAULT_LIST_LIMIT = 5;
const MAX_LIST_LIMIT = 10;

function parseTags(rawTags: string | undefined): string[] {
  if (!rawTags) {
    return [];
  }

  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function clampLimit(limit: number | null): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(limit, MAX_LIST_LIMIT);
}

export function parsePostCommand(content: string): PostPayload {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines[0]?.trim() !== '!post') {
    throw new Error('`!post` で始まるメッセージだけを下書き化できます。');
  }

  let index = 1;
  let sawBlankLine = false;
  const metadata = new Map<string, string>();

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      sawBlankLine = true;
      index += 1;
      break;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`メタデータ行が不正です: "${line}"。 \`key: value\` 形式で入力してください。`);
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (!value) {
      throw new Error(`\`${key}:\` の値が空です。必要な内容を入力してください。`);
    }

    metadata.set(key, value);
    index += 1;
  }

  const title = metadata.get('title');
  const body = lines.slice(index).join('\n').trim();

  if (!title) {
    throw new Error('`title:` は必須です。最初の数行に `title: タイトル` を入れてください。');
  }

  if (!sawBlankLine) {
    throw new Error('メタデータのあとに空行を 1 行入れてから本文を書いてください。');
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

function parseSlugCommand(kind: 'publish' | 'republish' | 'unpublish' | 'status' | 'preview', content: string): ParsedCommand {
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

function parseListCommand(kind: 'drafts' | 'recent', content: string): ParsedCommand {
  const parts = content.trim().split(/\s+/);
  const limit = clampLimit(parts[1] ? Number.parseInt(parts[1] ?? '', 10) : null);
  return { kind, limit };
}

export function parseCommand(content: string): ParsedCommand {
  const trimmed = content.trim();

  if (!trimmed.startsWith('!')) {
    return { kind: 'ignored' };
  }

  if (trimmed === '!help') {
    return { kind: 'help', verbose: false };
  }

  if (/^!help\s+(all|verbose|full)$/i.test(trimmed)) {
    return { kind: 'help', verbose: true };
  }

  if (trimmed.startsWith('!publish')) {
    return parseSlugCommand('publish', trimmed);
  }

  if (trimmed.startsWith('!republish')) {
    return parseSlugCommand('republish', trimmed);
  }

  if (trimmed.startsWith('!unpublish')) {
    return parseSlugCommand('unpublish', trimmed);
  }

  if (trimmed.startsWith('!status')) {
    return parseSlugCommand('status', trimmed);
  }

  if (trimmed.startsWith('!preview')) {
    return parseSlugCommand('preview', trimmed);
  }

  if (trimmed.startsWith('!drafts')) {
    return parseListCommand('drafts', trimmed);
  }

  if (trimmed.startsWith('!recent')) {
    return parseListCommand('recent', trimmed);
  }

  if (trimmed === '!cleanup-uploads') {
    return { kind: 'cleanupUploads' };
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
