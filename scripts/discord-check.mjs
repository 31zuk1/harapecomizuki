import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadRootEnv } from './env.mjs';

loadRootEnv();

const siteBaseUrl = process.env.SITE_BASE_URL ?? 'http://localhost:4321';
const required = ['DISCORD_TOKEN', 'BLOG_CHANNEL_ID', 'PUBLISHER_ROLE_ID'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill them before running the real Discord smoke test.');
  process.exit(1);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${url} -> ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

const me = await fetchJson('https://discord.com/api/v10/users/@me');
const channel = await fetchJson(`https://discord.com/api/v10/channels/${process.env.BLOG_CHANNEL_ID}`);
let publisherRoleName = null;

if (channel.guild_id) {
  const roles = await fetchJson(`https://discord.com/api/v10/guilds/${channel.guild_id}/roles`);
  publisherRoleName = roles.find((role) => role.id === process.env.PUBLISHER_ROLE_ID)?.name ?? null;
}

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), 'demo', 'fixtures', 'post-create.json'), 'utf8')
);

console.log('Discord env looks ready.');
console.log(`Bot user: ${me.username}#${me.discriminator ?? '0'} (${me.id})`);
console.log(`Channel: ${channel.name} (${channel.id})`);
console.log(
  publisherRoleName
    ? `Publisher role: ${publisherRoleName} (${process.env.PUBLISHER_ROLE_ID})`
    : `Publisher role id is configured: ${process.env.PUBLISHER_ROLE_ID}`
);
console.log(`Site base URL: ${siteBaseUrl}`);
console.log('');
console.log('Run this in another terminal:');
console.log('  npm run dev');
console.log('');
console.log('Then verify this flow in Discord:');
console.log('1. Paste the sample `!post` message below into the target channel');
console.log('2. Edit the same message and change a sentence');
console.log('3. As a user with the publisher role, run `!publish hello-from-discord`');
console.log(`4. Open ${new URL('posts/hello-from-discord/', siteBaseUrl.endsWith('/') ? siteBaseUrl : `${siteBaseUrl}/`).toString()} and confirm the update is visible`);
console.log('');
console.log(fixture.content);
