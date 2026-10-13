import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { CategoryType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TransactionWithCategory } from './dto/transaction-response.dto';
import { TransactionsService } from './transactions.service';

const TX_ID = '11111111-1111-4111-8111-111111111111';
const RENT_ID = '22222222-2222-4222-8222-222222222222';
const SALARY_ID = '33333333-3333-4333-8333-333333333333';

const ROW: TransactionWithCategory = {
  id: TX_ID,
  type: CategoryType.EXPENSE,
  amount: new Prisma.Decimal('22000'),
  date: new Date('2026-10-02T00:00:00.000Z'),
  note: null,
  categoryId: RENT_ID,
  category: { id: RENT_ID, name: 'Rent' },
  createdAt: new Date('2026-10-13T09:30:00.000Z'),
  updatedAt: new Date('2026-10-13T09:30:00.000Z'),
};

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`synthetic ${code}`, {
    code,
    clientVersion: 'test',
  });
}

describe('TransactionsService', () => {
  let service: TransactionsService;
  const transaction = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const category = { findUnique: jest.fn() };
  const $transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));

  /** Makes category.findUnique answer like the database: Rent is EXPENSE, Salary is INCOME. */
  function categoriesExist(): void {
    category.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === RENT_ID
          ? { name: 'Rent', type: CategoryType.EXPENSE }
          : where.id === SALARY_ID
            ? { name: 'Salary', type: CategoryType.INCOME }
            : null,
      ),
    );
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    $transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: { transaction, category, $transaction } },
      ],
    }).compile();
    service = moduleRef.get(TransactionsService);
  });

  describe('list', () => {
    it('builds the month range, filters, stable order and page window', async () => {
      transaction.findMany.mockResolvedValue([ROW]);
      transaction.count.mockResolvedValue(45);

      const result = await service.list({
        month: '2026-12',
        type: CategoryType.EXPENSE,
        categoryId: RENT_ID,
        page: 3,
        pageSize: 20,
      });

      const where = {
        date: {
          gte: new Date('2026-12-01T00:00:00.000Z'),
          lt: new Date('2027-01-01T00:00:00.000Z'),
        },
        type: CategoryType.EXPENSE,
        categoryId: RENT_ID,
      };
      expect(transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          skip: 40,
          take: 20,
        }),
      );
      expect(transaction.count).toHaveBeenCalledWith({ where });
      expect($transaction).toHaveBeenCalledTimes(1);
      expect(result.meta).toEqual({ page: 3, pageSize: 20, total: 45, totalPages: 3 });
      expect(result.data[0]).toMatchObject({ amount: '22000.00', date: '2026-10-02', note: null });
    });

    it('uses no filters when none are given and reports 0 pages for no results', async () => {
      transaction.findMany.mockResolvedValue([]);
      transaction.count.mockResolvedValue(0);

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(transaction.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe('findOne', () => {
    it('returns 404 when the transaction does not exist', async () => {
      transaction.findUnique.mockResolvedValue(null);
      await expect(service.findOne(TX_ID)).rejects.toThrow(
        new NotFoundException(`Transaction ${TX_ID} not found`),
      );
    });
  });

  describe('create', () => {
    const dto = {
      type: CategoryType.EXPENSE,
      amount: '22000.00',
      date: '2026-10-02',
      categoryId: RENT_ID,
    };

    it('stores the amount string and a UTC-midnight date', async () => {
      categoriesExist();
      transaction.create.mockResolvedValue(ROW);

      await service.create({ ...dto, note: 'October rent' });

      expect(transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            type: CategoryType.EXPENSE,
            amount: '22000.00',
            date: new Date('2026-10-02T00:00:00.000Z'),
            note: 'October rent',
            categoryId: RENT_ID,
          },
        }),
      );
    });

    it('stores a missing note as null', async () => {
      categoriesExist();
      transaction.create.mockResolvedValue(ROW);

      await service.create(dto);

      expect(transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ note: null }) as unknown }),
      );
    });

    it('rejects an unknown category with 400', async () => {
      categoriesExist();
      await expect(service.create({ ...dto, categoryId: TX_ID })).rejects.toThrow(
        new BadRequestException(`Category ${TX_ID} does not exist`),
      );
      expect(transaction.create).not.toHaveBeenCalled();
    });

    it('rejects a category of the other type with 400', async () => {
      categoriesExist();
      await expect(service.create({ ...dto, categoryId: SALARY_ID })).rejects.toThrow(
        new BadRequestException('Category "Salary" is INCOME but the transaction is EXPENSE'),
      );
    });

    it('maps a foreign-key failure (category deleted meanwhile) to 400', async () => {
      categoriesExist();
      transaction.create.mockRejectedValue(prismaError('P2003'));
      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update (merged record)', () => {
    beforeEach(() => {
      categoriesExist();
      transaction.findUnique.mockResolvedValue(ROW);
      transaction.update.mockResolvedValue(ROW);
    });

    it('rejects an empty body before touching the database', async () => {
      await expect(service.update(TX_ID, {})).rejects.toThrow(
        new BadRequestException('Request body must contain at least one field'),
      );
      expect(transaction.findUnique).not.toHaveBeenCalled();
    });

    it('treats a body with only undefined values as empty', async () => {
      await expect(service.update(TX_ID, { amount: undefined })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns 404 when the transaction does not exist', async () => {
      transaction.findUnique.mockResolvedValue(null);
      await expect(service.update(TX_ID, { amount: '1.00' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects changing only the type when the existing category has the other type', async () => {
      await expect(service.update(TX_ID, { type: CategoryType.INCOME })).rejects.toThrow(
        new BadRequestException('Category "Rent" is EXPENSE but the transaction is INCOME'),
      );
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('rejects changing only the category to one of the other type', async () => {
      await expect(service.update(TX_ID, { categoryId: SALARY_ID })).rejects.toThrow(
        new BadRequestException('Category "Salary" is INCOME but the transaction is EXPENSE'),
      );
    });

    it('accepts changing type and category together when they match', async () => {
      await service.update(TX_ID, { type: CategoryType.INCOME, categoryId: SALARY_ID });

      expect(category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SALARY_ID } }),
      );
      expect(transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { type: CategoryType.INCOME, categoryId: SALARY_ID } }),
      );
    });

    it('skips the category check when neither type nor category changes', async () => {
      await service.update(TX_ID, { amount: '99.90', date: '2026-10-31' });

      expect(category.findUnique).not.toHaveBeenCalled();
      expect(transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { amount: '99.90', date: new Date('2026-10-31T00:00:00.000Z') },
        }),
      );
    });

    it('clears the note with null', async () => {
      await service.update(TX_ID, { note: null });
      expect(transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { note: null } }),
      );
    });

    it('maps a record deleted meanwhile (P2025) to 404', async () => {
      transaction.update.mockRejectedValue(prismaError('P2025'));
      await expect(service.update(TX_ID, { amount: '1.00' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('maps a missing record (P2025) to 404', async () => {
      transaction.delete.mockRejectedValue(prismaError('P2025'));
      await expect(service.remove(TX_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('re-throws unexpected errors', async () => {
      const boom = new Error('connection lost');
      transaction.delete.mockRejectedValue(boom);
      await expect(service.remove(TX_ID)).rejects.toBe(boom);
    });
  });
});
