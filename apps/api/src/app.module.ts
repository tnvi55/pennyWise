import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CategoriesModule } from './categories/categories.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SummaryModule } from './summary/summary.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // apps/api/.env first (when started from apps/api), then the repository-root .env.
      // Real environment variables always win over values from these files.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    CategoriesModule,
    TransactionsModule,
    SummaryModule,
  ],
})
export class AppModule {}
