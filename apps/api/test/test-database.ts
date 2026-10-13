// Safety rules and helpers for the disposable e2e test database.
// Tests that touch PostgreSQL must only ever run against TEST_DATABASE_URL,
// and that URL must clearly point at a local, throwaway database.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { Client } from 'pg';

const API_ROOT = path.resolve(__dirname, '..');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const TEST_DB_NAME = /^[a-z0-9_]+_test$/;

/** Loads apps/api/.env and the repository-root .env, never overriding variables already set. */
export function loadEnvFiles(): void {
  for (const file of ['.env', '../../.env']) {
    const envPath = path.resolve(API_ROOT, file);
    if (existsSync(envPath)) process.loadEnvFile(envPath);
  }
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ''));
}

/**
 * Throws unless `testUrl` is a local PostgreSQL database whose name ends in `_test`
 * and which is not the development database. Messages never include the password.
 */
export function assertDisposableTestDatabase(
  testUrl: string | undefined,
  devUrl: string | undefined,
): URL {
  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Add it to .env (see .env.example); e2e tests never use DATABASE_URL.',
    );
  }

  let url: URL;
  try {
    url = new URL(testUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error('TEST_DATABASE_URL must be a postgresql:// URL.');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `TEST_DATABASE_URL host must be local (127.0.0.1 or localhost), got "${url.hostname}".`,
    );
  }
  const name = databaseName(url);
  if (!TEST_DB_NAME.test(name)) {
    throw new Error(
      `TEST_DATABASE_URL database must be lowercase letters, digits or _ and end in "_test", got "${name}".`,
    );
  }

  if (devUrl) {
    try {
      const dev = new URL(devUrl);
      if (dev.host === url.host && databaseName(dev) === name) {
        throw new Error('TEST_DATABASE_URL points at the same database as DATABASE_URL.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('TEST_DATABASE_URL')) throw error;
      // An unparsable DATABASE_URL cannot be the same database; the API's env validation reports it.
    }
  }
  return url;
}

/** Creates the test database if it does not exist yet (the name was validated above). */
export async function ensureDatabaseExists(testUrl: URL): Promise<void> {
  const name = databaseName(testUrl);
  const maintenance = new URL(testUrl);
  maintenance.pathname = '/postgres';
  maintenance.search = '';

  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) {
      // CREATE DATABASE cannot take a bind parameter; `name` matched /^[a-z0-9_]+_test$/.
      await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }
}

/** Applies the committed migrations to the test database (no new migrations are created). */
export function migrateTestDatabase(testUrl: URL): void {
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: 'pipe',
  });
}
