import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const CATEGORY_NAME_MAX_LENGTH = 80;

/**
 * Shared rules for a category name in create and update bodies:
 * surrounding spaces are trimmed first, then the name must be a non-empty string
 * of at most 80 characters. Non-strings (numbers, null, objects) are left untouched
 * by the trim, so IsString rejects them.
 */
export function IsCategoryName(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: 'Groceries',
      minLength: 1,
      maxLength: CATEGORY_NAME_MAX_LENGTH,
      description: 'Trimmed before validation. Unique together with type (case-sensitive).',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
    MaxLength(CATEGORY_NAME_MAX_LENGTH),
  );
}
