import { spawn } from 'node:child_process';
import { loadRootEnv } from './env.mjs';

loadRootEnv();

const commands = [
  {
    name: 'bot',
    child: spawn('npm', ['run', 'dev', '--workspace', '@discord-blog-poc/bot'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })
  },
  {
    name: 'site',
    child: spawn('npm', ['run', 'dev', '--workspace', '@discord-blog-poc/site'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32'
    })
  }
];

function shutdown(code = 0) {
  for (const command of commands) {
    command.child.kill('SIGTERM');
  }

  process.exit(code);
}

for (const command of commands) {
  command.child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
