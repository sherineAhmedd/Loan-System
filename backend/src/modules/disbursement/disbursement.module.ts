import { Module } from '@nestjs/common';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RollbacksModule } from '../rollback/rollback.module';
import { LoggingModule } from 'src/common/logging/logging.module';

@Module({
  imports: [PrismaModule, RollbacksModule , LoggingModule],
  controllers: [DisbursementController],
  providers: [DisbursementService],
})
export class DisbursementModule {}
