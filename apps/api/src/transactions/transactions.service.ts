import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { toUtcDate } from '../common/validation/calendar-date';
import { monthRange } from '../common/validation/month';
import { Prisma } from '../generated/prisma/client';
import type { CategoryType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import type { PaginatedTransactionsDto } from './dto/paginated-transactions.dto';
import type { TransactionResponseDto } from './dto/transaction-response.dto';
import { toTransactionResponse, TRANSACTION_INCLUDE } from './dto/transaction-response.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';

const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** Newest first; createdAt and id make the order stable for transactions on the same day. */
const LIST_ORDER: Prisma.TransactionOrderByWithRelationInput[] = [
  { date: 'desc' },
  { createdAt: 'desc' },
  { id: 'desc' },
];

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTransactionsQueryDto): Promise<PaginatedTransactionsDto> {
    const where: Prisma.TransactionWhereInput = {
      ...(query.month && { date: monthRange(query.month) }),
      ...(query.type && { type: query.type }),
      ...(query.categoryId && { categoryId: query.categoryId }),
    };

    // One database transaction, so the page and the total describe the same moment.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy: LIST_ORDER,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: rows.map(toTransactionResponse),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(id: string): Promise<TransactionResponseDto> {
    const row = await this.prisma.transaction.findUnique({
      where: { id },
      include: TRANSACTION_INCLUDE,
    });
    if (!row) throw transactionNotFound(id);
    return toTransactionResponse(row);
  }

  async create(dto: CreateTransactionDto): Promise<TransactionResponseDto> {
    await this.assertCategoryMatches(dto.categoryId, dto.type);
    try {
      const row = await this.prisma.transaction.create({
        data: {
          type: dto.type,
          amount: dto.amount, // a decimal string: Prisma stores it exactly
          date: toUtcDate(dto.date),
          note: dto.note ?? null,
          categoryId: dto.categoryId,
        },
        include: TRANSACTION_INCLUDE,
      });
      return toTransactionResponse(row);
    } catch (error) {
      // The category was deleted between the check above and the insert.
      if (hasPrismaCode(error, FOREIGN_KEY_VIOLATION)) throw categoryDoesNotExist(dto.categoryId);
      throw error;
    }
  }

  async update(id: string, dto: UpdateTransactionDto): Promise<TransactionResponseDto> {
    const changes = Object.entries(dto).filter(([, value]) => value !== undefined);
    if (changes.length === 0) {
      throw new BadRequestException('Request body must contain at least one field');
    }

    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (!existing) throw transactionNotFound(id);

    // Validate the record as it will be after the update, not only the fields that were sent:
    // changing just `type`, or just `categoryId`, can break the type/category match.
    if (dto.type !== undefined || dto.categoryId !== undefined) {
      await this.assertCategoryMatches(
        dto.categoryId ?? existing.categoryId,
        dto.type ?? existing.type,
      );
    }

    try {
      const row = await this.prisma.transaction.update({
        where: { id },
        data: {
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.date !== undefined && { date: toUtcDate(dto.date) }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        },
        include: TRANSACTION_INCLUDE,
      });
      return toTransactionResponse(row);
    } catch (error) {
      if (hasPrismaCode(error, RECORD_NOT_FOUND)) throw transactionNotFound(id);
      if (hasPrismaCode(error, FOREIGN_KEY_VIOLATION)) {
        throw categoryDoesNotExist(dto.categoryId ?? existing.categoryId);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.transaction.delete({ where: { id } });
    } catch (error) {
      if (hasPrismaCode(error, RECORD_NOT_FOUND)) throw transactionNotFound(id);
      throw error;
    }
  }

  /** 400 unless the category exists and has the same type as the transaction. */
  private async assertCategoryMatches(categoryId: string, type: CategoryType): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true, type: true },
    });
    if (!category) throw categoryDoesNotExist(categoryId);
    if (category.type !== type) {
      throw new BadRequestException(
        `Category "${category.name}" is ${category.type} but the transaction is ${type}`,
      );
    }
  }
}

function transactionNotFound(id: string): NotFoundException {
  return new NotFoundException(`Transaction ${id} not found`);
}

function categoryDoesNotExist(id: string): BadRequestException {
  return new BadRequestException(`Category ${id} does not exist`);
}
