import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { CategoryType } from '../../generated/prisma/client';

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ enum: CategoryType, enumName: 'CategoryType' })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;
}
