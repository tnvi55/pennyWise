import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { PaginatedTransactionsDto } from './dto/paginated-transactions.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Invalid input or category/type mismatch',
})
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List transactions: filter by month, type, category; newest first; paginated',
  })
  @ApiOkResponse({ type: PaginatedTransactionsDto })
  list(@Query() query: ListTransactionsQueryDto): Promise<PaginatedTransactionsDto> {
    return this.transactionsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one transaction' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TransactionResponseDto> {
    return this.transactionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Record an income or expense' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  create(@Body() dto: CreateTransactionDto): Promise<TransactionResponseDto> {
    return this.transactionsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a transaction; the merged record is validated' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.transactionsService.remove(id);
  }
}
