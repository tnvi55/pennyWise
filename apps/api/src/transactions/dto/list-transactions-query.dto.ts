import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { IsMonth } from '../../common/validation/month';
import { CategoryType } from '../../generated/prisma/client';

export const MAX_PAGE_SIZE = 100;

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ example: '2026-10', description: 'YYYY-MM; whole calendar month.' })
  @IsOptional()
  @IsMonth()
  month?: string;

  @ApiPropertyOptional({ enum: CategoryType, enumName: 'CategoryType' })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // Query strings are text; @Type converts "2" to 2 before validation ("abc" becomes NaN and fails).
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize = 20;
}
