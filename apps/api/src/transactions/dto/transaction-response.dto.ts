import { ApiProperty } from '@nestjs/swagger';

import { toDateString } from '../../common/validation/calendar-date';
import type { Transaction } from '../../generated/prisma/client';
import { CategoryType } from '../../generated/prisma/client';

export class TransactionCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Groceries' })
  name!: string;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CategoryType, enumName: 'CategoryType', example: CategoryType.EXPENSE })
  type!: CategoryType;

  @ApiProperty({ example: '125.50', description: 'Always exactly 2 decimals.' })
  amount!: string;

  @ApiProperty({ format: 'date', example: '2026-10-03' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Weekly groceries' })
  note!: string | null;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ type: TransactionCategoryDto })
  category!: TransactionCategoryDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** The Prisma query shape every transaction read uses: the row plus its category's id and name. */
export const TRANSACTION_INCLUDE = { category: { select: { id: true, name: true } } } as const;

export type TransactionWithCategory = Transaction & { category: { id: string; name: string } };

export function toTransactionResponse(row: TransactionWithCategory): TransactionResponseDto {
  return {
    id: row.id,
    type: row.type,
    // Decimal → fixed 2-decimal string, computed by decimal.js: no JS floating point.
    amount: row.amount.toFixed(2),
    date: toDateString(row.date),
    note: row.note,
    categoryId: row.categoryId,
    category: { id: row.category.id, name: row.category.name },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
