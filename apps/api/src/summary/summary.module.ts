import { Module } from '@nestjs/common';

import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

// PrismaService comes from the global PrismaModule, so it is not imported here.
@Module({
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
