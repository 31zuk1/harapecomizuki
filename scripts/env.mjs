import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(raw) {
  const parsed = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, value] = match;
    parsed[key] = stripQuotes(value.trim());
  }

  return parsed;
}

export function loadRootEnv(cwd = process.cwd()) {
  for (const fileName of ['.env', '.env.local']) {
    const envPath = path.join(cwd, fileName);
    if (!existsSync(envPath)) {
      continue;
    }

    const parsed = parseEnvFile(readFileSync(envPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
