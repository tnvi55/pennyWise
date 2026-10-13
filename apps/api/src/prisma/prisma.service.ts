import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * The one database client for the whole API. Feature services inject it and call
 * typed methods such as `this.prisma.category.findMany()`; Prisma turns them into
 * parameterized SQL and runs it on PostgreSQL through the `pg` driver adapter.
 *
 * The connection opens lazily on the first query, so the API (and the e2e tests
 * that need no database) can start while PostgreSQL is down.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
