import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './db-helpers';

type Kind = 'INCOME' | 'EXPENSE';

interface TransactionBody {
  id: string;
  type: Kind;
  amount: string;
  date: string;
  note: string | null;
  categoryId: string;
  category: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface PageBody {
  data: TransactionBody[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Transactions API (e2e, real PostgreSQL test database)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let rent: string; // EXPENSE category
  let groceries: string; // EXPENSE category
  let salary: string; // INCOME category

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    const make = async (name: string, type: Kind): Promise<string> =>
      (await prisma.category.create({ data: { name, type } })).id;
    rent = await make('Rent', 'EXPENSE');
    groceries = await make('Groceries', 'EXPENSE');
    salary = await make('Salary', 'INCOME');
  });

  afterAll(async () => {
    await app.close();
  });

  function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      type: 'EXPENSE',
      amount: '125.50',
      date: '2026-10-03',
      categoryId: groceries,
      ...overrides,
    };
  }

  async function create(overrides: Record<string, unknown> = {}): Promise<TransactionBody> {
    const response = await http.post('/api/v1/transactions').send(body(overrides)).expect(201);
    return response.body as TransactionBody;
  }

  async function list(query = ''): Promise<PageBody> {
    const response = await http.get(`/api/v1/transactions${query}`).expect(200);
    return response.body as PageBody;
  }

  function expectErrorBody(raw: unknown, statusCode: number): ErrorBody {
    const error = raw as ErrorBody;
    expect(Object.keys(error).sort()).toEqual(['error', 'message', 'statusCode']);
    expect(error.statusCode).toBe(statusCode);
    expect(JSON.stringify(error)).not.toMatch(
      /prisma|P20\d\d|constraint|violates|SELECT|INSERT|DELETE FROM/i,
    );
    return error;
  }

  describe('POST /api/v1/transactions', () => {
    it('creates a transaction and returns the full response shape', async () => {
      const created = await create({ note: '  Weekly groceries  ' });

      expect(Object.keys(created).sort()).toEqual([
        'amount',
        'category',
        'categoryId',
        'createdAt',
        'date',
        'id',
        'note',
        'type',
        'updatedAt',
      ]);
      expect(created).toMatchObject({
        type: 'EXPENSE',
        amount: '125.50',
        date: '2026-10-03',
        note: 'Weekly groceries',
        categoryId: groceries,
        category: { id: groceries, name: 'Groceries' },
      });
    });

    it('returns every amount with exactly two decimals', async () => {
      await expect(create({ amount: '5' })).resolves.toMatchObject({ amount: '5.00' });
      await expect(create({ amount: '0.1' })).resolves.toMatchObject({ amount: '0.10' });
      await expect(create({ amount: '9999999999.99' })).resolves.toMatchObject({
        amount: '9999999999.99',
      });
    });

    it('stores decimals exactly: 0.10 + 0.20 is 0.30 in SQL', async () => {
      await create({ amount: '0.10' });
      await create({ amount: '0.20' });
      const [row] = await prisma.$queryRaw<{ total: string }[]>`
        SELECT sum(amount)::text AS total FROM transactions`;
      expect(row?.total).toBe('0.30');
    });

    it('stores the calendar date without timezone drift', async () => {
      const created = await create({ date: '2026-10-31' });
      expect(created.date).toBe('2026-10-31');

      const [row] = await prisma.$queryRaw<{ day: string }[]>`
        SELECT date::text AS day FROM transactions WHERE id = ${created.id}::uuid`;
      expect(row?.day).toBe('2026-10-31');
    });

    it('accepts 29 February in a leap year', async () => {
      await expect(create({ date: '2028-02-29' })).resolves.toMatchObject({ date: '2028-02-29' });
    });

    it('stores an empty or whitespace note as null', async () => {
      await expect(create({ note: '   ' })).resolves.toMatchObject({ note: null });
      await expect(create({ note: null })).resolves.toMatchObject({ note: null });
    });

    it('accepts a 250-character note', async () => {
      await create({ note: 'n'.repeat(250) });
    });

    it('records income against an income category', async () => {
      await expect(
        create({ type: 'INCOME', categoryId: salary, amount: '85000.00' }),
      ).resolves.toMatchObject({ type: 'INCOME', category: { name: 'Salary' } });
    });

    it.each([
      ['a JSON number', { amount: 125.5 }, /amount must be a positive decimal string/],
      ['zero', { amount: '0' }, /amount/],
      ['zero with decimals', { amount: '0.00' }, /amount/],
      ['a negative amount', { amount: '-5.00' }, /amount/],
      ['a plus sign', { amount: '+5' }, /amount/],
      ['exponent notation', { amount: '1e3' }, /amount/],
      ['three decimals', { amount: '1.005' }, /amount/],
      ['a leading zero', { amount: '01.50' }, /amount/],
      ['surrounding spaces', { amount: ' 5' }, /amount/],
      ['above the maximum', { amount: '10000000000.00' }, /amount/],
      ['a missing amount', { amount: undefined }, /amount/],
      ['an impossible date', { date: '2026-02-29' }, /date must be a real calendar date/],
      ['day 31 in a 30-day month', { date: '2026-04-31' }, /date/],
      ['a datetime', { date: '2026-10-03T10:00:00Z' }, /date/],
      ['a null date', { date: null }, /date/],
      ['a non-padded date', { date: '2026-1-3' }, /date/],
      ['an unknown type', { type: 'TRANSFER' }, /type must be one of/],
      ['a malformed categoryId', { categoryId: 'abc' }, /categoryId must be a UUID/],
      ['a 251-character note', { note: 'n'.repeat(251) }, /note must be shorter/],
      ['a numeric note', { note: 42 }, /note must be a string/],
      ['an unknown field', { currency: 'USD' }, /property currency should not exist/],
    ])('returns 400 for %s and stores nothing', async (_case, overrides, expected) => {
      const response = await http.post('/api/v1/transactions').send(body(overrides)).expect(400);

      expect(JSON.stringify(expectErrorBody(response.body, 400).message)).toMatch(expected);
      await expect(prisma.transaction.count()).resolves.toBe(0);
    });

    it('returns 400 for a category that does not exist', async () => {
      const response = await http
        .post('/api/v1/transactions')
        .send(body({ categoryId: MISSING_ID }))
        .expect(400);
      expect(expectErrorBody(response.body, 400).message).toBe(
        `Category ${MISSING_ID} does not exist`,
      );
    });

    it('returns 400 when the category type does not match the transaction type', async () => {
      const response = await http
        .post('/api/v1/transactions')
        .send(body({ type: 'INCOME', categoryId: rent }))
        .expect(400);
      expect(expectErrorBody(response.body, 400).message).toBe(
        'Category "Rent" is EXPENSE but the transaction is INCOME',
      );
      await expect(prisma.transaction.count()).resolves.toBe(0);
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('returns one transaction', async () => {
      const created = await create();
      const response = await http.get(`/api/v1/transactions/${created.id}`).expect(200);
      expect(response.body).toEqual(created);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      expectErrorBody((await http.get(`/api/v1/transactions/${MISSING_ID}`).expect(404)).body, 404);
      expectErrorBody((await http.get('/api/v1/transactions/xyz').expect(400)).body, 400);
    });
  });

  describe('GET /api/v1/transactions (filter, sort, paginate)', () => {
    it('returns an empty page with totalPages 0', async () => {
      await expect(list()).resolves.toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    });

    it('includes the first and last day of the month and excludes the neighbours', async () => {
      await create({ date: '2026-09-30', note: 'before' });
      await create({ date: '2026-10-01', note: 'first' });
      await create({ date: '2026-10-31', note: 'last' });
      await create({ date: '2026-11-01', note: 'after' });

      const page = await list('?month=2026-10');
      expect(page.data.map((t) => t.note)).toEqual(['last', 'first']);
      expect(page.meta.total).toBe(2);
    });

    it('rolls December over into January', async () => {
      await create({ date: '2026-12-31', note: 'dec' });
      await create({ date: '2027-01-01', note: 'jan' });

      expect((await list('?month=2026-12')).data.map((t) => t.note)).toEqual(['dec']);
      expect((await list('?month=2027-01')).data.map((t) => t.note)).toEqual(['jan']);
    });

    it('filters by type and by category, alone and combined', async () => {
      await create({ categoryId: rent, note: 'rent' });
      await create({ categoryId: groceries, note: 'groceries' });
      await create({ type: 'INCOME', categoryId: salary, note: 'salary' });

      expect((await list('?type=INCOME')).data.map((t) => t.note)).toEqual(['salary']);
      expect((await list(`?categoryId=${rent}`)).data.map((t) => t.note)).toEqual(['rent']);
      expect((await list(`?type=INCOME&categoryId=${rent}`)).data).toEqual([]);
      expect((await list(`?categoryId=${MISSING_ID}`)).meta.total).toBe(0);
    });

    it('sorts newest date first, then newest created, then id', async () => {
      await create({ date: '2026-10-01', note: 'old' });
      const first = await create({ date: '2026-10-05', note: 'same-day-1' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await create({ date: '2026-10-05', note: 'same-day-2' });

      expect((await list()).data.map((t) => t.note)).toEqual(['same-day-2', 'same-day-1', 'old']);
      expect(Date.parse(second.createdAt)).toBeGreaterThan(Date.parse(first.createdAt));
    });

    it('paginates with stable pages and correct meta', async () => {
      for (let day = 1; day <= 5; day += 1) {
        await create({ date: `2026-10-0${day}`, note: `d${day}` });
      }

      const page1 = await list('?pageSize=2');
      const page2 = await list('?pageSize=2&page=2');
      const page3 = await list('?pageSize=2&page=3');
      const page4 = await list('?pageSize=2&page=4');

      expect(page1.data.map((t) => t.note)).toEqual(['d5', 'd4']);
      expect(page2.data.map((t) => t.note)).toEqual(['d3', 'd2']);
      expect(page3.data.map((t) => t.note)).toEqual(['d1']);
      expect(page4.data).toEqual([]);
      expect(page1.meta).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
      expect(page4.meta).toEqual({ page: 4, pageSize: 2, total: 5, totalPages: 3 });
    });

    it('accepts the maximum page size of 100', async () => {
      expect((await list('?pageSize=100')).meta.pageSize).toBe(100);
    });

    it.each([
      ['month 13', '?month=2026-13'],
      ['a full date as month', '?month=2026-10-01'],
      ['a non-padded month', '?month=2026-1'],
      ['an unknown type', '?type=TRANSFER'],
      ['a malformed categoryId', '?categoryId=abc'],
      ['page 0', '?page=0'],
      ['a negative page', '?page=-1'],
      ['a non-numeric page', '?page=abc'],
      ['a fractional page', '?page=1.5'],
      ['pageSize 0', '?pageSize=0'],
      ['pageSize 101', '?pageSize=101'],
      ['an unknown query parameter', '?sort=amount'],
    ])('returns 400 for %s', async (_case, query) => {
      const response = await http.get(`/api/v1/transactions${query}`).expect(400);
      expectErrorBody(response.body, 400);
    });
  });

  describe('PATCH /api/v1/transactions/:id', () => {
    it('updates only the sent fields and keeps the rest', async () => {
      const created = await create({ note: 'keep me' });

      const response = await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send({ amount: '99.9', date: '2026-10-31' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.id,
        type: 'EXPENSE',
        amount: '99.90',
        date: '2026-10-31',
        note: 'keep me',
        categoryId: groceries,
      });
    });

    it('moves a transaction to another category of the same type', async () => {
      const created = await create();
      const response = await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send({ categoryId: rent })
        .expect(200);
      expect(response.body).toMatchObject({ categoryId: rent, category: { name: 'Rent' } });
    });

    it('switches type and category together when they match', async () => {
      const created = await create();
      const response = await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send({ type: 'INCOME', categoryId: salary })
        .expect(200);
      expect(response.body).toMatchObject({ type: 'INCOME', categoryId: salary });
    });

    it('rejects changing only the type when the merged record would mismatch', async () => {
      const created = await create();
      const response = await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send({ type: 'INCOME' })
        .expect(400);

      expect(expectErrorBody(response.body, 400).message).toBe(
        'Category "Groceries" is EXPENSE but the transaction is INCOME',
      );
      const after = await http.get(`/api/v1/transactions/${created.id}`).expect(200);
      expect((after.body as TransactionBody).type).toBe('EXPENSE');
    });

    it('rejects changing only the category to one of the other type', async () => {
      const created = await create();
      await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send({ categoryId: salary })
        .expect(400);
    });

    it('rejects a category that does not exist', async () => {
      const created = await create();
      const response = await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send({ categoryId: MISSING_ID })
        .expect(400);
      expect(expectErrorBody(response.body, 400).message).toBe(
        `Category ${MISSING_ID} does not exist`,
      );
    });

    it('clears the note with null', async () => {
      const created = await create({ note: 'temporary' });
      const response = await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send({ note: null })
        .expect(200);
      expect((response.body as TransactionBody).note).toBeNull();
    });

    it('rejects an empty body', async () => {
      const created = await create();
      const response = await http.patch(`/api/v1/transactions/${created.id}`).send({}).expect(400);
      expect(expectErrorBody(response.body, 400).message).toBe(
        'Request body must contain at least one field',
      );
    });

    it.each([
      ['a null type', { type: null }],
      ['a null amount', { amount: null }],
      ['a null date', { date: null }],
      ['a null categoryId', { categoryId: null }],
      ['a numeric amount', { amount: 10 }],
      ['three decimals', { amount: '1.999' }],
      ['an impossible date', { date: '2026-09-31' }],
      ['an unknown field', { id: MISSING_ID }],
    ])('returns 400 for %s', async (_case, payload) => {
      const created = await create();
      const response = await http
        .patch(`/api/v1/transactions/${created.id}`)
        .send(payload)
        .expect(400);
      expectErrorBody(response.body, 400);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      await http.patch(`/api/v1/transactions/${MISSING_ID}`).send({ amount: '1.00' }).expect(404);
      await http.patch('/api/v1/transactions/xyz').send({ amount: '1.00' }).expect(400);
    });
  });

  describe('DELETE /api/v1/transactions/:id', () => {
    it('deletes with 204 and no body', async () => {
      const created = await create();
      const response = await http.delete(`/api/v1/transactions/${created.id}`).expect(204);

      expect(response.text).toBe('');
      await http.get(`/api/v1/transactions/${created.id}`).expect(404);
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      expectErrorBody(
        (await http.delete(`/api/v1/transactions/${MISSING_ID}`).expect(404)).body,
        404,
      );
      await http.delete('/api/v1/transactions/123').expect(400);
    });

    it('lets a category be deleted once its last transaction is gone', async () => {
      const created = await create({ categoryId: rent });
      await http.delete(`/api/v1/categories/${rent}`).expect(409);

      await http.delete(`/api/v1/transactions/${created.id}`).expect(204);
      await http.delete(`/api/v1/categories/${rent}`).expect(204);
    });
  });

  describe('OpenAPI', () => {
    it('documents every transaction route', async () => {
      const response = await http.get('/api/docs-json').expect(200);
      const paths = (response.body as { paths: Record<string, Record<string, unknown>> }).paths;

      expect(Object.keys(paths['/api/v1/transactions'] ?? {}).sort()).toEqual(['get', 'post']);
      expect(Object.keys(paths['/api/v1/transactions/{id}'] ?? {}).sort()).toEqual([
        'delete',
        'get',
        'patch',
      ]);
    });
  });
});
