import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadRootEnv } from './env.mjs';

loadRootEnv();

const siteBaseUrl = process.env.SITE_BASE_URL ?? 'http://localhost:4321/';
const registryPath = path.join(process.cwd(), 'data', 'posts.json');

const buildResult = spawnSync('npm', ['run', 'build'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'pages.yml');
if (!existsSync(workflowPath)) {
  console.error('GitHub Pages workflow is missing.');
  process.exit(1);
}

if (!existsSync(registryPath)) {
  console.error('Post registry is missing.');
  console.error('Run `npm run demo` or publish a real Discord post before checking Pages deployment.');
  process.exit(1);
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const publishedPost = Object.values(registry.posts ?? {}).find((post) => post.status === 'published');

if (!publishedPost) {
  console.error('No published post was found in data/posts.json.');
  console.error('Run `npm run demo` or publish a real Discord post before checking Pages deployment.');
  process.exit(1);
}

const siteUrl = new URL(siteBaseUrl.endsWith('/') ? siteBaseUrl : `${siteBaseUrl}/`);
const basePath = siteUrl.pathname.replace(/\/$/, '');
const indexHtml = readFileSync(path.join(process.cwd(), 'apps', 'site', 'dist', 'index.html'), 'utf8');
const articleHtmlPath = path.join(
  process.cwd(),
  'apps',
  'site',
  'dist',
  'posts',
  publishedPost.slug,
  'index.html'
);
if (!existsSync(articleHtmlPath)) {
  console.error(
    `Expected a published article at apps/site/dist/posts/${publishedPost.slug}/index.html, but none was built.`
  );
  console.error('Run `npm run demo` or publish a real Discord post before checking Pages deployment.');
  process.exit(1);
}

const articleHtml = readFileSync(articleHtmlPath, 'utf8');
const expectedArticleHref = `${basePath || ''}/posts/${publishedPost.slug}/`;

if (!indexHtml.includes(expectedArticleHref)) {
  console.error(`Expected index.html to include ${expectedArticleHref}, but it did not.`);
  process.exit(1);
}

if (Array.isArray(publishedPost.attachments) && publishedPost.attachments.length > 0) {
  if (!articleHtml.includes(siteUrl.origin + `${basePath || ''}/uploads/`)) {
    console.error('Expected article HTML to include the SITE_BASE_URL-based uploads URL, but it did not.');
    process.exit(1);
  }
} else {
  console.log('Published post has no attachments, so uploads URL validation was skipped.');
}

console.log('Pages build looks ready.');
console.log(`Base path: ${basePath || '/'}`);
console.log(`Checked slug: ${publishedPost.slug}`);
console.log(`Expected public article URL: ${new URL(`posts/${publishedPost.slug}/`, siteUrl).toString()}`);
if (!process.env.SITE_BASE_URL) {
  console.log('SITE_BASE_URL was not set, so the local default http://localhost:4321/ was used.');
  console.log('Set SITE_BASE_URL to your GitHub Pages URL before the real deploy check.');
}
console.log('');
console.log('Next step to trigger deploy: push this project to the `main` branch of a GitHub repository.');
