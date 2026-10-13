import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { CategoryType } from '../../generated/prisma/client';
import { IsCategoryName } from './category-name';

export class CreateCategoryDto {
  @IsCategoryName()
  name!: string;

  @ApiProperty({ enum: CategoryType, enumName: 'CategoryType', example: CategoryType.EXPENSE })
  @IsEnum(CategoryType)
  type!: CategoryType;
}
