import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadRootEnv } from './env.mjs';

loadRootEnv();

const entrypoint = path.join(process.cwd(), 'apps', 'bot', 'dist', 'index.js');

if (!existsSync(entrypoint)) {
  console.error('Built bot entrypoint is missing: apps/bot/dist/index.js');
  console.error('Run `npm run build` before `npm run start:bot`.');
  process.exit(1);
}

const child = spawn(process.execPath, [entrypoint], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
