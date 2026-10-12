import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({
    description: 'Server time when the check ran, as an ISO 8601 UTC string.',
    format: 'date-time',
    example: '2026-10-12T09:30:00.000Z',
  })
  timestamp!: string;
}
