import { ApiProperty } from '@nestjs/swagger';

import { TransactionResponseDto } from './transaction-response.dto';

export class PageMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 7, description: 'Number of matching transactions across all pages.' })
  total!: number;

  @ApiProperty({ example: 1, description: '0 when there are no matching transactions.' })
  totalPages!: number;
}

export class PaginatedTransactionsDto {
  @ApiProperty({ type: TransactionResponseDto, isArray: true })
  data!: TransactionResponseDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}
