import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ErrorResponseDto } from './common/dto/error-response.dto';
import { UnhandledExceptionFilter } from './common/filters/unhandled-exception.filter';
import type { EnvironmentVariables } from './config/env.validation';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

/**
 * HTTP-level setup shared by main.ts and the e2e tests, so tests exercise the
 * same prefix, validation, CORS and OpenAPI document as the real server.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties without validation decorators...
      forbidNonWhitelisted: true, // ...and reject the request instead of silently stripping
      transform: true, // turn plain JSON into DTO class instances
    }),
  );

  // Unexpected errors become a generic 500 in the documented error shape.
  app.useGlobalFilters(new UnhandledExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  // Only the configured frontend origin may call the API from a browser. An allow-list
  // (not a plain string) makes `cors` compare each request's Origin and omit the
  // Access-Control-Allow-Origin header for any other origin.
  app.enableCors({ origin: [config.get('CORS_ORIGIN', { infer: true })] });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('PennyWise API')
      .setDescription('Personal expense tracker REST API (single user, INR).')
      .setVersion('1.0')
      .build(),
    { extraModels: [ErrorResponseDto] },
  );
  SwaggerModule.setup(DOCS_PATH, app, document, { jsonDocumentUrl: `${DOCS_PATH}-json` });
}
