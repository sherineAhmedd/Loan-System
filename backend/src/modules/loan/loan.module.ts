import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { PrismaModule } from 'src/prisma/prisma.module';


@Module({
  imports:[PrismaModule],
  controllers: [LoanController],
  providers: [LoanService]
})
export class LoanModule {}
