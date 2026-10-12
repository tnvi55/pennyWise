import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';

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
    HealthModule,
  ],
})
export class AppModule {}
