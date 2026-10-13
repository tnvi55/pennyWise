import type { INestApplication } from '@nestjs/common';

import { PrismaService } from '../src/prisma/prisma.service';
import { assertDisposableTestDatabase } from './test-database';

/**
 * Empties the app tables between tests. It re-checks, right before deleting, that the
 * API is connected to the disposable test database and not to any other database.
 */
export async function resetDatabase(app: INestApplication): Promise<void> {
  assertDisposableTestDatabase(process.env.DATABASE_URL, undefined);
  if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error('Refusing to reset: DATABASE_URL is not the configured TEST_DATABASE_URL.');
  }

  const prisma = app.get(PrismaService);
  // Transactions first: categories they reference cannot be deleted before them (RESTRICT).
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
}
