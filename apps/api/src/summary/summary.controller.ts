import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { SummaryResponseDto } from './dto/summary-response.dto';
import { SummaryService } from './summary.service';

@ApiTags('summary')
@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  @ApiOperation({ summary: 'Monthly income, expenses, net balance and expenses by category' })
  @ApiOkResponse({ type: SummaryResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Missing or invalid month' })
  get(@Query() query: SummaryQueryDto): Promise<SummaryResponseDto> {
    return this.summaryService.forMonth(query.month);
  }
}
