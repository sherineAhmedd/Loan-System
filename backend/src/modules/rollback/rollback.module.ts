import { Module } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { RollbacksService } from './rollback.service';

@Module({
  providers: [RollbacksService, PrismaService],
  exports: [RollbacksService],
})
export class RollbacksModule {}
