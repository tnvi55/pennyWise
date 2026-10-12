import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { API_PREFIX, configureApp, DOCS_PATH } from './app.setup';
import { AppModule } from './app.module';
import type { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  // Bind to localhost only: this unauthenticated MVP must not be reachable from the network.
  await app.listen(port, '127.0.0.1');

  const logger = new Logger('Bootstrap');
  logger.log(`API:  http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Docs: http://localhost:${port}/${DOCS_PATH}`);
}

void bootstrap();
