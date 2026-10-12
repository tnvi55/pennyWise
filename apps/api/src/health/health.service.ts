import { Injectable } from '@nestjs/common';

import type { HealthResponseDto } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  /** Liveness only: the process is up and serving HTTP. A database check arrives in Phase 2. */
  check(): HealthResponseDto {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
