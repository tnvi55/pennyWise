import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './db-helpers';

type Kind = 'INCOME' | 'EXPENSE';

interface SummaryBody {
  month: string;
  currency: string;
  income: string;
  expenses: string;
  net: string;
  expensesByCategory: { categoryId: string; categoryName: string; amount: string }[];
}

describe('Summary API (e2e, real PostgreSQL test database)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  const ids: Record<string, string> = {};

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
    const categories: [string, Kind][] = [
      ['Salary', 'INCOME'],
      ['Freelance', 'INCOME'],
      ['Rent', 'EXPENSE'],
      ['Groceries', 'EXPENSE'],
      ['Transport', 'EXPENSE'],
      ['Utilities', 'EXPENSE'],
      ['Eating out', 'EXPENSE'],
      ['Unused', 'EXPENSE'],
    ];
    for (const [name, type] of categories) {
      ids[name] = (await prisma.category.create({ data: { name, type } })).id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  /** Records a transaction through the real API, so the summary sees exactly what users create. */
  async function add(category: string, amount: string, date: string): Promise<void> {
    const type: Kind = category === 'Salary' || category === 'Freelance' ? 'INCOME' : 'EXPENSE';
    await http
      .post('/api/v1/transactions')
      .send({ type, amount, date, categoryId: ids[category] })
      .expect(201);
  }

  async function summary(month: string): Promise<SummaryBody> {
    const response = await http.get(`/api/v1/summary?month=${month}`).expect(200);
    return response.body as SummaryBody;
  }

  it('returns zeros and an empty breakdown for a month without transactions', async () => {
    await expect(summary('2026-10')).resolves.toEqual({
      month: '2026-10',
      currency: 'INR',
      income: '0.00',
      expenses: '0.00',
      net: '0.00',
      expensesByCategory: [],
    });
  });

  it('matches the September 2026 seed totals and breakdown order', async () => {
    // The same rows as prisma/seed.ts for September 2026.
    await add('Salary', '85000.00', '2026-09-01');
    await add('Rent', '22000.00', '2026-09-02');
    await add('Groceries', '3450.75', '2026-09-05');
    await add('Transport', '640.00', '2026-09-08');
    await add('Utilities', '1899.50', '2026-09-12');
    await add('Freelance', '12500.00', '2026-09-18');
    await add('Eating out', '1240.10', '2026-09-21');
    await add('Groceries', '2875.20', '2026-09-30');

    const result = await summary('2026-09');

    expect(result).toMatchObject({ income: '97500.00', expenses: '32105.55', net: '65394.45' });
    expect(result.expensesByCategory).toEqual([
      { categoryId: ids.Rent, categoryName: 'Rent', amount: '22000.00' },
      { categoryId: ids.Groceries, categoryName: 'Groceries', amount: '6325.95' },
      { categoryId: ids.Utilities, categoryName: 'Utilities', amount: '1899.50' },
      { categoryId: ids['Eating out'], categoryName: 'Eating out', amount: '1240.10' },
      { categoryId: ids.Transport, categoryName: 'Transport', amount: '640.00' },
    ]);
  });

  it('lists only expense categories that have expenses that month', async () => {
    await add('Salary', '100.00', '2026-10-01');
    await add('Rent', '50.00', '2026-10-02');
    await add('Groceries', '10.00', '2026-11-02'); // other month

    const names = (await summary('2026-10')).expensesByCategory.map((c) => c.categoryName);
    expect(names).toEqual(['Rent']); // not Salary (income), Groceries (other month) or Unused
  });

  it('reports a negative net when expenses exceed income', async () => {
    await add('Salary', '1000.00', '2026-10-01');
    await add('Rent', '2500.50', '2026-10-02');

    await expect(summary('2026-10')).resolves.toMatchObject({
      income: '1000.00',
      expenses: '2500.50',
      net: '-1500.50',
    });
  });

  it('adds decimals exactly: 0.10 + 0.20 = 0.30', async () => {
    await add('Groceries', '0.10', '2026-10-03');
    await add('Groceries', '0.20', '2026-10-03');

    const result = await summary('2026-10');
    expect(result.expenses).toBe('0.30');
    expect(result.net).toBe('-0.30');
    expect(result.expensesByCategory[0]?.amount).toBe('0.30');
  });

  it('sums beyond a single amount limit without overflow or rounding', async () => {
    await add('Salary', '9999999999.99', '2026-10-01');
    await add('Freelance', '9999999999.99', '2026-10-02');
    await add('Rent', '0.01', '2026-10-03');

    await expect(summary('2026-10')).resolves.toMatchObject({
      income: '19999999999.98',
      expenses: '0.01',
      net: '19999999999.97',
    });
  });

  it('includes the first and last day of the month and excludes the neighbours', async () => {
    await add('Rent', '1.00', '2026-09-30');
    await add('Rent', '10.00', '2026-10-01');
    await add('Rent', '100.00', '2026-10-31');
    await add('Rent', '1000.00', '2026-11-01');

    await expect(summary('2026-10')).resolves.toMatchObject({ expenses: '110.00' });
  });

  it('rolls December over into January', async () => {
    await add('Rent', '5.00', '2026-12-31');
    await add('Rent', '7.00', '2027-01-01');

    await expect(summary('2026-12')).resolves.toMatchObject({ expenses: '5.00' });
    await expect(summary('2027-01')).resolves.toMatchObject({ expenses: '7.00' });
  });

  it('orders equal category totals by name', async () => {
    await add('Utilities', '40.00', '2026-10-01');
    await add('Groceries', '40.00', '2026-10-01');
    await add('Transport', '99.00', '2026-10-01');

    const names = (await summary('2026-10')).expensesByCategory.map((c) => c.categoryName);
    expect(names).toEqual(['Transport', 'Groceries', 'Utilities']);
  });

  it('counts every transaction, independent of list pagination', async () => {
    for (let i = 1; i <= 25; i += 1) {
      await add('Groceries', '1.00', `2026-10-${String((i % 28) + 1).padStart(2, '0')}`);
    }

    const listPage = await http.get('/api/v1/transactions?month=2026-10').expect(200);
    expect((listPage.body as { data: unknown[] }).data).toHaveLength(20);
    await expect(summary('2026-10')).resolves.toMatchObject({ expenses: '25.00' });
  });

  it.each([
    ['a missing month', ''],
    ['month 13', '?month=2026-13'],
    ['a full date', '?month=2026-10-01'],
    ['a non-padded month', '?month=2026-1'],
    ['an unknown parameter', '?month=2026-10&type=EXPENSE'],
  ])('returns 400 for %s', async (_case, query) => {
    const response = await http.get(`/api/v1/summary${query}`).expect(400);
    const body = response.body as { statusCode: number; error: string; message: unknown };

    expect(Object.keys(body).sort()).toEqual(['error', 'message', 'statusCode']);
    expect(body.statusCode).toBe(400);
  });

  it('is documented in OpenAPI', async () => {
    const response = await http.get('/api/docs-json').expect(200);
    const doc = response.body as {
      paths: Record<string, { get?: unknown }>;
      components: { schemas: Record<string, unknown> };
    };

    expect(doc.paths['/api/v1/summary']?.get).toBeDefined();
    expect(doc.components.schemas).toHaveProperty('SummaryResponseDto');
  });
});
