import { Module } from '@nestjs/common';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RollbacksModule } from '../rollback/rollback.module';

@Module({
  imports: [PrismaModule, RollbacksModule],
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
})
export class RepaymentsModule {}
