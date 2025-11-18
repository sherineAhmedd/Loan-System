import { Module } from '@nestjs/common';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
     imports:[PrismaModule],   // IMPORTANT
  controllers: [DisbursementController],
  providers: [DisbursementService],
})
export class DisbursementModule {}
