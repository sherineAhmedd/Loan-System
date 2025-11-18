import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DisbursementModule } from './modules/disbursement/disbursement.module';
import { RepaymentsModule } from './modules/repayments/repayments.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoanModule } from './modules/loan/loan.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [DisbursementModule, RepaymentsModule , PrismaModule, LoanModule, AuditModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
