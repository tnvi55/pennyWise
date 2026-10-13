import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { SummaryService } from './summary.service';

const RENT_ID = '22222222-2222-4222-8222-222222222222';

describe('SummaryService', () => {
  let service: SummaryService;
  // $queryRaw is a tagged template: it receives (strings, ...values).
  const $queryRaw = jest.fn<unknown, [TemplateStringsArray, ...unknown[]]>();
  const $transaction = jest.fn();

  function databaseReturns(totals: unknown, breakdown: unknown): void {
    $transaction.mockResolvedValue([totals, breakdown]);
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SummaryService,
        { provide: PrismaService, useValue: { $queryRaw, $transaction } },
      ],
    }).compile();
    service = moduleRef.get(SummaryService);
  });

  it('combines totals and breakdown with the month and currency', async () => {
    databaseReturns(
      [{ income: '97500.00', expenses: '32105.55', net: '65394.45' }],
      [{ categoryId: RENT_ID, categoryName: 'Rent', amount: '22000.00' }],
    );

    await expect(service.forMonth('2026-09')).resolves.toEqual({
      month: '2026-09',
      currency: 'INR',
      income: '97500.00',
      expenses: '32105.55',
      net: '65394.45',
      expensesByCategory: [{ categoryId: RENT_ID, categoryName: 'Rent', amount: '22000.00' }],
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('passes the month bounds as YYYY-MM-DD parameters, rolling December into January', async () => {
    databaseReturns([{ income: '0.00', expenses: '0.00', net: '0.00' }], []);

    await service.forMonth('2026-12');

    expect($queryRaw).toHaveBeenCalledTimes(2);
    for (const [, ...values] of $queryRaw.mock.calls) {
      expect(values).toEqual(['2026-12-01', '2027-01-01']);
    }
  });

  it('accepts a negative net', async () => {
    databaseReturns([{ income: '0.00', expenses: '1500.00', net: '-1500.00' }], []);
    await expect(service.forMonth('2026-10')).resolves.toMatchObject({ net: '-1500.00' });
  });

  it.each([
    ['a number instead of a string', [{ income: 0, expenses: '0.00', net: '0.00' }]],
    ['too few decimals', [{ income: '5.0', expenses: '0.00', net: '5.0' }]],
    ['a missing field', [{ income: '0.00', expenses: '0.00' }]],
    ['no row', []],
    ['two rows', [{}, {}]],
  ])('rejects a totals result with %s', async (_case, totals) => {
    databaseReturns(totals, []);
    await expect(service.forMonth('2026-10')).rejects.toThrow(/Unexpected summary totals row/);
  });

  it.each([
    ['a numeric amount', [{ categoryId: RENT_ID, categoryName: 'Rent', amount: 22000 }]],
    ['a missing name', [{ categoryId: RENT_ID, amount: '1.00' }]],
    ['not an array', { categoryId: RENT_ID }],
  ])('rejects a breakdown with %s', async (_case, breakdown) => {
    databaseReturns([{ income: '0.00', expenses: '0.00', net: '0.00' }], breakdown);
    await expect(service.forMonth('2026-10')).rejects.toThrow(/Unexpected expenses-by-category/);
  });
});
