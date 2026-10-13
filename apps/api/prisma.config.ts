// Prisma CLI configuration (migrate, generate, db seed). Prisma 7 no longer reads
// .env files by itself, so load them here with Node's built-in loader.
import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'prisma/config';

// Same order as the API's ConfigModule: apps/api/.env, then the repository-root .env.
// process.loadEnvFile never overrides variables that are already set (e.g. in CI).
for (const file of ['.env', '../../.env']) {
  const envPath = path.resolve(__dirname, file);
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read directly instead of env('DATABASE_URL'): `prisma generate` and `prisma validate`
    // need no database, so they must work in CI without the variable.
    url: process.env.DATABASE_URL ?? '',
  },
});
