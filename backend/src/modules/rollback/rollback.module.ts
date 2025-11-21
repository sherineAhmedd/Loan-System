import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RollbacksService } from './rollback.service';

@Module({
  imports: [PrismaModule],
  providers: [RollbacksService],
  exports: [RollbacksService],
})
export class RollbacksModule {}
