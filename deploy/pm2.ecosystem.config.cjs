module.exports = {
  apps: [
    {
      name: 'discord-blog-bot',
      cwd: process.cwd(),
      script: 'npm',
      args: 'run start:bot',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
