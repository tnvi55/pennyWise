// Runs before every e2e test file (after globalSetup, before setup-env.ts). The API
// under test reads DATABASE_URL, so point it at the checked test database. Real
// environment variables win over .env values, so ConfigModule sees this URL, never the dev one.
import { assertDisposableTestDatabase, loadEnvFiles } from './test-database';

loadEnvFiles();
assertDisposableTestDatabase(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
