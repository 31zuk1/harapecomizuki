import { spawn } from 'node:child_process';
import { loadRootEnv } from './env.mjs';

loadRootEnv();

const child = spawn('npm', ['run', 'preview', '--workspace', '@discord-blog-poc/site'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
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
