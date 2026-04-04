import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RegistryFile } from './types';

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

export async function ensureDir(targetDir: string): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
}

export async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readRegistryFile(registryFile: string): Promise<RegistryFile> {
  try {
    const raw = await fs.readFile(registryFile, 'utf8');
    const parsed = JSON.parse(raw) as RegistryFile;
    return parsed.posts ? parsed : { posts: {} };
  } catch {
    return { posts: {} };
  }
}

export async function writeRegistryFile(registryFile: string, registry: RegistryFile): Promise<void> {
  await ensureDir(path.dirname(registryFile));
  await fs.writeFile(registryFile, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

export function slugify(input: string, fallbackSeed: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `post-${fallbackSeed}`;
}

export function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

export function sanitizeFileName(fileName: string): string {
  const parsed = path.parse(fileName);
  const baseName = parsed.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  const ext = parsed.ext.toLowerCase() || '.bin';
  return `${baseName || 'attachment'}${ext}`;
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export function isImageAttachment(fileName: string, contentType?: string | null): boolean {
  if (contentType?.startsWith('image/')) {
    return true;
  }

  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export function renderFrontmatter(frontmatter: Record<string, string | string[] | boolean | null>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }

      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${JSON.stringify(item)}`);
      }
      continue;
    }

    if (value === null) {
      lines.push(`${key}: null`);
      continue;
    }

    if (typeof value === 'boolean') {
      lines.push(`${key}: ${value ? 'true' : 'false'}`);
      continue;
    }

    lines.push(`${key}: ${JSON.stringify(value)}`);
  }

  lines.push('---', '');
  return lines.join('\n');
}
