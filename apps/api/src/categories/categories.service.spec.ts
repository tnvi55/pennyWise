import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { Category } from '../generated/prisma/client';
import { CategoryType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const ID = '3f2b6c1e-8d4a-4c3b-9f1e-2a7d5b6c8e90';
const ROW: Category = {
  id: ID,
  name: 'Groceries',
  type: CategoryType.EXPENSE,
  createdAt: new Date('2026-10-13T09:30:00.000Z'),
  updatedAt: new Date('2026-10-13T09:45:00.000Z'),
};
const RESPONSE = {
  id: ID,
  name: 'Groceries',
  type: 'EXPENSE',
  createdAt: '2026-10-13T09:30:00.000Z',
  updatedAt: '2026-10-13T09:45:00.000Z',
};

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`synthetic ${code}`, {
    code,
    clientVersion: 'test',
  });
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  const category = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: { category } }],
    }).compile();
    service = moduleRef.get(CategoriesService);
  });

  describe('list', () => {
    it('returns every category in a stable order, mapped to the response shape', async () => {
      category.findMany.mockResolvedValue([ROW]);

      await expect(service.list()).resolves.toEqual([RESPONSE]);
      expect(category.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ name: 'asc' }, { type: 'asc' }, { id: 'asc' }],
      });
    });

    it('filters by type when given', async () => {
      category.findMany.mockResolvedValue([]);

      await service.list(CategoryType.INCOME);
      expect(category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: CategoryType.INCOME } }),
      );
    });
  });

  describe('create', () => {
    it('creates the category and maps the row', async () => {
      category.create.mockResolvedValue(ROW);

      await expect(
        service.create({ name: 'Groceries', type: CategoryType.EXPENSE }),
      ).resolves.toEqual(RESPONSE);
      expect(category.create).toHaveBeenCalledWith({
        data: { name: 'Groceries', type: CategoryType.EXPENSE },
      });
    });

    it('turns a unique violation (P2002) into 409 Conflict', async () => {
      category.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create({ name: 'Groceries', type: CategoryType.EXPENSE }),
      ).rejects.toThrow(new ConflictException('Category "Groceries" (EXPENSE) already exists'));
    });

    it('re-throws unexpected errors unchanged', async () => {
      const boom = new Error('connection lost');
      category.create.mockRejectedValue(boom);

      await expect(service.create({ name: 'X', type: CategoryType.EXPENSE })).rejects.toBe(boom);
    });
  });

  describe('rename', () => {
    it('updates only the name', async () => {
      category.update.mockResolvedValue({ ...ROW, name: 'Food' });

      await expect(service.rename(ID, { name: 'Food' })).resolves.toMatchObject({ name: 'Food' });
      expect(category.update).toHaveBeenCalledWith({ where: { id: ID }, data: { name: 'Food' } });
    });

    it('turns a missing record (P2025) into 404 Not Found', async () => {
      category.update.mockRejectedValue(prismaError('P2025'));

      await expect(service.rename(ID, { name: 'Food' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('turns a unique violation (P2002) into 409 Conflict', async () => {
      category.update.mockRejectedValue(prismaError('P2002'));

      await expect(service.rename(ID, { name: 'Rent' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes by id', async () => {
      category.delete.mockResolvedValue(ROW);

      await expect(service.remove(ID)).resolves.toBeUndefined();
      expect(category.delete).toHaveBeenCalledWith({ where: { id: ID } });
    });

    it('turns a missing record (P2025) into 404 Not Found', async () => {
      category.delete.mockRejectedValue(prismaError('P2025'));

      await expect(service.remove(ID)).rejects.toThrow(
        new NotFoundException(`Category ${ID} not found`),
      );
    });

    it('turns a foreign-key RESTRICT failure (P2003) into 409 Conflict', async () => {
      category.delete.mockRejectedValue(prismaError('P2003'));

      await expect(service.remove(ID)).rejects.toThrow(
        new ConflictException('Category is used by one or more transactions and cannot be deleted'),
      );
    });

    it('does not map unrelated Prisma errors', async () => {
      const other = prismaError('P2034');
      category.delete.mockRejectedValue(other);

      await expect(service.remove(ID)).rejects.toBe(other);
    });
  });
});
