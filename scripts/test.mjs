import { spawnSync } from 'node:child_process';
import { loadRootEnv } from './env.mjs';

loadRootEnv();

const result = spawnSync('npm', ['run', 'test', '--workspace', '@discord-blog-poc/bot'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(result.status ?? 1);
