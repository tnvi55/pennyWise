import { ApiProperty } from '@nestjs/swagger';

import { IsMonth } from '../../common/validation/month';

export class SummaryQueryDto {
  @ApiProperty({ example: '2026-10', description: 'Required. YYYY-MM; the whole calendar month.' })
  @IsMonth()
  month!: string;
}
