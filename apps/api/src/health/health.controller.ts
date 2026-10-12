import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  // Nest's dependency injection container creates HealthService and passes it in here.
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check that the API is running' })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto {
    return this.healthService.check();
  }
}
