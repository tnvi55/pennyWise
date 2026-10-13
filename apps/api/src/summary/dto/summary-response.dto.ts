import { ApiProperty } from '@nestjs/swagger';

export class CategoryExpenseDto {
  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ example: 'Rent' })
  categoryName!: string;

  @ApiProperty({
    example: '22000.00',
    description: 'Total expenses in this category for the month.',
  })
  amount!: string;
}

export class SummaryResponseDto {
  @ApiProperty({ example: '2026-10' })
  month!: string;

  @ApiProperty({ example: 'INR', enum: ['INR'] })
  currency!: 'INR';

  @ApiProperty({ example: '86500.00', description: 'Sum of INCOME amounts; "0.00" when none.' })
  income!: string;

  @ApiProperty({ example: '23450.29', description: 'Sum of EXPENSE amounts; "0.00" when none.' })
  expenses!: string;

  @ApiProperty({ example: '63049.71', description: 'income - expenses; may be negative.' })
  net!: string;

  @ApiProperty({
    type: CategoryExpenseDto,
    isArray: true,
    description:
      'Only categories with expenses this month, largest first (ties: by name, then id).',
  })
  expensesByCategory!: CategoryExpenseDto[];
}
