import { ApiProperty } from '@nestjs/swagger';

import type { Category } from '../../generated/prisma/client';
import { CategoryType } from '../../generated/prisma/client';

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid', example: '3f2b6c1e-8d4a-4c3b-9f1e-2a7d5b6c8e90' })
  id!: string;

  @ApiProperty({ example: 'Groceries' })
  name!: string;

  @ApiProperty({ enum: CategoryType, enumName: 'CategoryType', example: CategoryType.EXPENSE })
  type!: CategoryType;

  @ApiProperty({ format: 'date-time', example: '2026-10-13T09:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-13T09:30:00.000Z' })
  updatedAt!: string;
}

/** Builds the public response from a database row, so new columns never leak by accident. */
export function toCategoryResponse(category: Category): CategoryResponseDto {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
