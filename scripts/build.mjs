import { spawnSync } from 'node:child_process';
import { loadRootEnv } from './env.mjs';

loadRootEnv();

const commands = [
  ['npm', ['run', 'build', '--workspace', '@discord-blog-poc/bot']],
  ['npm', ['run', 'build', '--workspace', '@discord-blog-poc/site']]
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
