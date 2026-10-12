import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const ALLOWED_ORIGIN = 'http://localhost:5173';

describe('API skeleton (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 { status: "ok", timestamp } as JSON', async () => {
      const before = Date.now();
      const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      const after = Date.now();

      expect(response.headers['content-type']).toMatch(/application\/json/);
      const body = response.body as { status: unknown; timestamp: unknown };
      expect(body.status).toBe('ok');
      expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);

      // A full ISO 8601 UTC string, taken while this request was being handled.
      expect(typeof body.timestamp).toBe('string');
      const timestamp = String(body.timestamp);
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      const time = Date.parse(timestamp);
      expect(time).toBeGreaterThanOrEqual(before);
      expect(time).toBeLessThanOrEqual(after);
    });
  });

  describe('global prefix', () => {
    it('does not serve routes without /api/v1', async () => {
      // Outside the prefix Nest registers no handler, so Express answers with its default HTML 404.
      await request(app.getHttpServer()).get('/health').expect(404);
    });

    it('returns the standard JSON error shape for unknown routes under /api/v1', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/unknown').expect(404);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Cannot GET /api/v1/unknown',
      });
    });
  });

  describe('OpenAPI', () => {
    it('serves Swagger UI at /api/docs', async () => {
      const response = await request(app.getHttpServer()).get('/api/docs').expect(200);
      expect(response.text).toContain('Swagger UI');
    });

    it('documents the health endpoint and its response schema', async () => {
      const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
      const document = response.body as {
        info: { title: string };
        paths: Record<string, { get?: { responses: Record<string, unknown> } }>;
        components: {
          schemas: Record<string, { required?: string[]; properties?: Record<string, unknown> }>;
        };
      };

      expect(document.info.title).toBe('PennyWise API');
      expect(document.paths['/api/v1/health']?.get?.responses).toHaveProperty('200');
      const health = document.components.schemas['HealthResponseDto'];
      expect(health?.required).toEqual(expect.arrayContaining(['status', 'timestamp']));
      expect(health?.properties?.['timestamp']).toMatchObject({
        type: 'string',
        format: 'date-time',
      });
      expect(document.components.schemas).toHaveProperty('ErrorResponseDto');
    });
  });

  describe('CORS', () => {
    it('allows the configured frontend origin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);
      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });

    it('does not allow other origins', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('Origin', 'http://evil.example')
        .expect(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('answers preflight requests from the allowed origin', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/health')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'PATCH')
        .expect(204);
      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(response.headers['access-control-allow-methods']).toContain('PATCH');
    });
  });
});
