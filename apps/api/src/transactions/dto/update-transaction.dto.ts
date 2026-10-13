import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

import { IsCalendarDate } from '../../common/validation/calendar-date';
import { IsMoneyString } from '../../common/validation/money';
import { CategoryType } from '../../generated/prisma/client';
import { NOTE_MAX_LENGTH, trimNote } from './create-transaction.dto';

/** Validate a field only when it was sent. Unlike @IsOptional, null is still validated (and rejected). */
const whenPresent = ValidateIf((_object, value) => value !== undefined);

/**
 * Partial update. Every field is optional, but:
 * - `type`, `amount`, `date` and `categoryId` cannot be null (they are required columns);
 * - `note: null` clears the note;
 * - the service rejects an empty body and validates the merged record (type vs category).
 */
export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: CategoryType, enumName: 'CategoryType' })
  @whenPresent
  @IsEnum(CategoryType)
  type?: CategoryType;

  @ApiPropertyOptional({ type: String, example: '99.90' })
  @whenPresent
  @IsMoneyString()
  amount?: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-10-04' })
  @whenPresent
  @IsCalendarDate()
  date?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: NOTE_MAX_LENGTH,
    description: 'null clears the note.',
  })
  @Transform(trimNote)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  note?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @whenPresent
  @IsUUID()
  categoryId?: string;
}
