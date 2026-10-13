// Jest globalSetup for the e2e suite: runs once, before any test file.
// Verifies TEST_DATABASE_URL is a disposable local test database, creates it if
// needed and applies the committed Prisma migrations to it.
import {
  assertDisposableTestDatabase,
  ensureDatabaseExists,
  loadEnvFiles,
  migrateTestDatabase,
} from './test-database';

export default async function globalSetup(): Promise<void> {
  loadEnvFiles();
  const testUrl = assertDisposableTestDatabase(
    process.env.TEST_DATABASE_URL,
    process.env.DATABASE_URL,
  );
  await ensureDatabaseExists(testUrl);
  migrateTestDatabase(testUrl);
}
