import { resolveAppConfig } from './config';
import { startDiscordBot } from './discord-bot';

async function main(): Promise<void> {
  const config = resolveAppConfig();

  if (!config.discordToken) {
    console.log('DISCORD_TOKEN が未設定のため bot は待機しています。`npm run demo` を使うと Discord なしで動作確認できます。');
    return;
  }

  await startDiscordBot(config);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
