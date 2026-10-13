import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

import { IsCalendarDate } from '../../common/validation/calendar-date';
import { IsMoneyString } from '../../common/validation/money';
import { CategoryType } from '../../generated/prisma/client';

export const NOTE_MAX_LENGTH = 250;

/** Trims a note; a note that is empty after trimming becomes null (no note). */
export const trimNote = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class CreateTransactionDto {
  @ApiProperty({ enum: CategoryType, enumName: 'CategoryType', example: CategoryType.EXPENSE })
  @IsEnum(CategoryType)
  type!: CategoryType;

  @ApiProperty({
    type: String,
    example: '125.50',
    description:
      'Positive decimal string, at most 2 decimals and 9999999999.99. JSON numbers are rejected.',
  })
  @IsMoneyString()
  amount!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-10-03',
    description: 'Calendar date, YYYY-MM-DD.',
  })
  @IsCalendarDate()
  date!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: NOTE_MAX_LENGTH,
    example: 'Weekly groceries',
    description: 'Trimmed; an empty note is stored as null.',
  })
  @Transform(trimNote)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  note?: string | null;

  @ApiProperty({ format: 'uuid', description: 'Must be an existing category of the same type.' })
  @IsUUID()
  categoryId!: string;
}
