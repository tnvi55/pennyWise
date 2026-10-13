import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './db-helpers';

interface CategoryBody {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  createdAt: string;
  updatedAt: string;
}

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Categories API (e2e, real PostgreSQL test database)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCategory(name: string, type: 'INCOME' | 'EXPENSE'): Promise<CategoryBody> {
    const response = await http.post('/api/v1/categories').send({ name, type }).expect(201);
    return response.body as CategoryBody;
  }

  /** Every error must use the documented shape and never leak database internals. */
  function expectErrorBody(body: unknown, statusCode: number): ErrorBody {
    const error = body as ErrorBody;
    expect(Object.keys(error).sort()).toEqual(['error', 'message', 'statusCode']);
    expect(error.statusCode).toBe(statusCode);
    expect(JSON.stringify(error)).not.toMatch(
      /prisma|P20\d\d|constraint|violates|SELECT|INSERT|DELETE FROM/i,
    );
    return error;
  }

  describe('POST /api/v1/categories', () => {
    it('creates a category and returns 201 with the response shape', async () => {
      const response = await http
        .post('/api/v1/categories')
        .send({ name: 'Groceries', type: 'EXPENSE' })
        .expect(201);
      const body = response.body as CategoryBody;

      expect(Object.keys(body).sort()).toEqual(['createdAt', 'id', 'name', 'type', 'updatedAt']);
      expect(body).toMatchObject({ name: 'Groceries', type: 'EXPENSE' });
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.createdAt).toMatch(ISO_UTC);
      expect(body.updatedAt).toMatch(ISO_UTC);
    });

    it('trims the name before saving', async () => {
      const created = await createCategory('  Food  ', 'EXPENSE');
      expect(created.name).toBe('Food');
    });

    it('accepts an 80-character name', async () => {
      await createCategory('a'.repeat(80), 'EXPENSE');
    });

    it('allows the same name once per type', async () => {
      await createCategory('Other', 'EXPENSE');
      await createCategory('Other', 'INCOME');
    });

    it('treats names case-sensitively', async () => {
      await createCategory('Rent', 'EXPENSE');
      await createCategory('rent', 'EXPENSE');
    });

    it('returns 409 for a duplicate name and type', async () => {
      await createCategory('Groceries', 'EXPENSE');
      const response = await http
        .post('/api/v1/categories')
        .send({ name: 'Groceries', type: 'EXPENSE' })
        .expect(409);

      const error = expectErrorBody(response.body, 409);
      expect(error.message).toBe('Category "Groceries" (EXPENSE) already exists');
    });

    it('returns 409 when the trimmed name collides', async () => {
      await createCategory('Groceries', 'EXPENSE');
      await http
        .post('/api/v1/categories')
        .send({ name: ' Groceries ', type: 'EXPENSE' })
        .expect(409);
    });

    it.each([
      ['missing name', { type: 'EXPENSE' }, /name/],
      ['blank name', { name: '   ', type: 'EXPENSE' }, /name should not be empty/],
      ['81-character name', { name: 'a'.repeat(81), type: 'EXPENSE' }, /name must be shorter/],
      ['null name', { name: null, type: 'EXPENSE' }, /name must be a string/],
      ['numeric name', { name: 42, type: 'EXPENSE' }, /name must be a string/],
      ['missing type', { name: 'Food' }, /type must be one of/],
      ['unknown type', { name: 'Food', type: 'SAVINGS' }, /type must be one of/],
      ['lowercase type', { name: 'Food', type: 'expense' }, /type must be one of/],
      [
        'unknown field',
        { name: 'Food', type: 'EXPENSE', colour: 'red' },
        /property colour should not exist/,
      ],
    ])('returns 400 for %s', async (_case, payload, expected) => {
      const response = await http.post('/api/v1/categories').send(payload).expect(400);

      const error = expectErrorBody(response.body, 400);
      expect(error.error).toBe('Bad Request');
      expect(JSON.stringify(error.message)).toMatch(expected);
    });

    it('stores nothing when validation fails', async () => {
      await http.post('/api/v1/categories').send({ name: '', type: 'EXPENSE' }).expect(400);
      const response = await http.get('/api/v1/categories').expect(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/v1/categories', () => {
    it('returns an empty array when there are no categories', async () => {
      const response = await http.get('/api/v1/categories').expect(200);
      expect(response.body).toEqual([]);
    });

    it('lists categories sorted by name, then type', async () => {
      await createCategory('Salary', 'INCOME');
      await createCategory('Other', 'INCOME');
      await createCategory('Groceries', 'EXPENSE');
      await createCategory('Other', 'EXPENSE');

      const response = await http.get('/api/v1/categories').expect(200);
      const list = (response.body as CategoryBody[]).map((c) => `${c.name}/${c.type}`);
      // Enum order in PostgreSQL is declaration order: INCOME before EXPENSE.
      expect(list).toEqual(['Groceries/EXPENSE', 'Other/INCOME', 'Other/EXPENSE', 'Salary/INCOME']);
    });

    it('filters by type', async () => {
      await createCategory('Salary', 'INCOME');
      await createCategory('Rent', 'EXPENSE');

      const response = await http.get('/api/v1/categories?type=INCOME').expect(200);
      expect((response.body as CategoryBody[]).map((c) => c.name)).toEqual(['Salary']);
    });

    it.each([
      ['an unknown type', '?type=SAVINGS'],
      ['an unknown query parameter', '?sort=name'],
    ])('returns 400 for %s', async (_case, query) => {
      const response = await http.get(`/api/v1/categories${query}`).expect(400);
      expectErrorBody(response.body, 400);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('renames the category, keeps its type and updates updatedAt', async () => {
      const created = await createCategory('Food', 'EXPENSE');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await http
        .patch(`/api/v1/categories/${created.id}`)
        .send({ name: '  Groceries ' })
        .expect(200);
      const body = response.body as CategoryBody;

      expect(body).toMatchObject({ id: created.id, name: 'Groceries', type: 'EXPENSE' });
      expect(body.createdAt).toBe(created.createdAt);
      expect(Date.parse(body.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
    });

    it('allows renaming to its own current name', async () => {
      const created = await createCategory('Food', 'EXPENSE');
      await http.patch(`/api/v1/categories/${created.id}`).send({ name: 'Food' }).expect(200);
    });

    it('rejects changing the type (type is immutable)', async () => {
      const created = await createCategory('Food', 'EXPENSE');
      const response = await http
        .patch(`/api/v1/categories/${created.id}`)
        .send({ name: 'Food', type: 'INCOME' })
        .expect(400);

      expect(JSON.stringify(expectErrorBody(response.body, 400).message)).toMatch(
        /property type should not exist/,
      );
      const list = await http.get('/api/v1/categories').expect(200);
      expect((list.body as CategoryBody[])[0]?.type).toBe('EXPENSE');
    });

    it.each([
      ['an empty body', {}],
      ['a blank name', { name: ' ' }],
      ['a null name', { name: null }],
      ['an 81-character name', { name: 'b'.repeat(81) }],
    ])('returns 400 for %s', async (_case, payload) => {
      const created = await createCategory('Food', 'EXPENSE');
      const response = await http
        .patch(`/api/v1/categories/${created.id}`)
        .send(payload)
        .expect(400);
      expectErrorBody(response.body, 400);
    });

    it('returns 409 when another category of the same type has that name', async () => {
      await createCategory('Rent', 'EXPENSE');
      const food = await createCategory('Food', 'EXPENSE');

      const response = await http
        .patch(`/api/v1/categories/${food.id}`)
        .send({ name: 'Rent' })
        .expect(409);
      expectErrorBody(response.body, 409);
    });

    it('allows a name that only exists for the other type', async () => {
      await createCategory('Other', 'INCOME');
      const misc = await createCategory('Misc', 'EXPENSE');
      await http.patch(`/api/v1/categories/${misc.id}`).send({ name: 'Other' }).expect(200);
    });

    it('returns 404 for a valid but unknown id', async () => {
      const response = await http
        .patch(`/api/v1/categories/${MISSING_ID}`)
        .send({ name: 'Food' })
        .expect(404);
      expect(expectErrorBody(response.body, 404).message).toBe(`Category ${MISSING_ID} not found`);
    });

    it('returns 400 for a malformed id', async () => {
      const response = await http
        .patch('/api/v1/categories/not-a-uuid')
        .send({ name: 'Food' })
        .expect(400);
      expectErrorBody(response.body, 400);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('deletes an unused category with 204 and no body', async () => {
      const created = await createCategory('Food', 'EXPENSE');

      const response = await http.delete(`/api/v1/categories/${created.id}`).expect(204);
      expect(response.text).toBe('');
      const list = await http.get('/api/v1/categories').expect(200);
      expect(list.body).toEqual([]);
    });

    it('returns 409 while a transaction references the category, and keeps both', async () => {
      const rent = await createCategory('Rent', 'EXPENSE');
      const prisma = app.get(PrismaService);
      await prisma.transaction.create({
        data: {
          type: 'EXPENSE',
          amount: '22000.00',
          date: new Date('2026-10-02T00:00:00.000Z'),
          categoryId: rent.id,
        },
      });

      const response = await http.delete(`/api/v1/categories/${rent.id}`).expect(409);
      expect(expectErrorBody(response.body, 409).message).toBe(
        'Category is used by one or more transactions and cannot be deleted',
      );
      await expect(prisma.category.count()).resolves.toBe(1);
      await expect(prisma.transaction.count()).resolves.toBe(1);
    });

    it('returns 404 for a valid but unknown id', async () => {
      const response = await http.delete(`/api/v1/categories/${MISSING_ID}`).expect(404);
      expectErrorBody(response.body, 404);
    });

    it('returns 404 when deleting the same category twice', async () => {
      const created = await createCategory('Food', 'EXPENSE');
      await http.delete(`/api/v1/categories/${created.id}`).expect(204);
      await http.delete(`/api/v1/categories/${created.id}`).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      const response = await http.delete('/api/v1/categories/123').expect(400);
      expectErrorBody(response.body, 400);
    });
  });

  describe('OpenAPI', () => {
    it('documents every category route', async () => {
      const response = await http.get('/api/docs-json').expect(200);
      const paths = (response.body as { paths: Record<string, Record<string, unknown>> }).paths;

      expect(Object.keys(paths['/api/v1/categories'] ?? {}).sort()).toEqual(['get', 'post']);
      expect(Object.keys(paths['/api/v1/categories/{id}'] ?? {}).sort()).toEqual([
        'delete',
        'patch',
      ]);
    });
  });
});
