import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ResolvedConfig } from './types';

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function findRepoRoot(startDir: string): string {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(currentDir, 'package.json');

    if (existsSync(candidate)) {
      try {
        const packageJson = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };

        if (packageJson.name === 'discord-blog-poc') {
          return currentDir;
        }
      } catch {
        // Ignore malformed package.json while walking up.
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
}

export function resolveAppConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): ResolvedConfig {
  const repoRoot = env.BLOG_REPO_ROOT ?? findRepoRoot(cwd);

  return {
    repoRoot,
    discordToken: env.DISCORD_TOKEN,
    blogChannelId: env.BLOG_CHANNEL_ID ?? 'demo-blog-channel',
    publisherRoleId: env.PUBLISHER_ROLE_ID,
    gitAutoCommit: parseBoolean(env.GIT_AUTO_COMMIT),
    gitAutoPush: parseBoolean(env.GIT_AUTO_PUSH),
    siteBaseUrl: env.SITE_BASE_URL ?? 'http://localhost:4321',
    gitAuthorName: env.GIT_AUTHOR_NAME,
    gitAuthorEmail: env.GIT_AUTHOR_EMAIL,
    draftsDir: path.join(repoRoot, 'content', 'drafts'),
    publishedDir: path.join(repoRoot, 'apps', 'site', 'src', 'posts'),
    uploadsDir: path.join(repoRoot, 'apps', 'site', 'public', 'uploads'),
    registryFile: path.join(repoRoot, 'data', 'posts.json'),
    siteDir: path.join(repoRoot, 'apps', 'site')
  };
}
