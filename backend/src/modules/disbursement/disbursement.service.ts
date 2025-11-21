import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDisbursementDto } from './dto/create-disbursement.dto';
import { RollbackDisbursementDto } from './dto/rollback-disbursement.dto';
import { RepaymentScheduleEntry } from './interface/loan-disbursement.interface';
import { RollbacksService } from '../rollback/rollback.service';

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rollbacksService: RollbacksService,
  ) {}

  async createDisbursement(payload: CreateDisbursementDto) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: payload.loanId },
      include: { disbursement: true },
    });

    if (!loan) {
      throw new BadRequestException('Loan not found');
    }

    if (loan.status !== 'APPROVED') {
      throw new BadRequestException('Only approved loans can be disbursed');
    }

    if (loan.disbursement) {
      throw new BadRequestException('This loan has already been disbursed');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await this.ensurePlatformFunds(tx, payload.amount);

        const pendingDisbursement = await tx.disbursement.create({
          data: {
            loanId: loan.id,
            amount: payload.amount,
            disbursementDate: payload.disbursementDate,
            status: payload.status ?? 'pending',
          },
        });

        const scheduleData = this.buildRepaymentSchedule({
          loanId: loan.id,
          amount: payload.amount,
          interestRate: payload.interestRate,
          tenor: payload.tenor,
          firstPaymentDate: payload.firstPaymentDate,
        });

        if (scheduleData.length) {
          await tx.repaymentSchedule.createMany({ data: scheduleData });
        }

        await tx.auditLog.create({
          data: {
            transactionId: pendingDisbursement.id,
            operation: 'LOAN_DISBURSEMENT',
            metadata: {
              loanId: loan.id,
              borrowerId: payload.borrowerId,
              amount: payload.amount,
              currency: payload.currency,
              tenor: payload.tenor,
            },
          },
        });

        const completed = await tx.disbursement.update({
          where: { id: pendingDisbursement.id },
          data: { status: 'completed' },
          include: {
            loan: true,
          },
        });

        return completed;
      });

      return result;
    } 
    catch (error) {
      this.logger.error('Disbursement failed', error.stack);

      await this.prisma.rollbackRecord.create({
        data: {
          transactionId: payload.loanId,
          originalOperation: 'CREATE_DISBURSEMENT',
          rollbackReason: error.message ?? 'UNKNOWN_ERROR',
          compensatingActions: {
            loanId: payload.loanId,
            attemptedAmount: payload.amount,
          },
        },
      });

      throw new BadRequestException(
        error?.message ?? 'Failed to create disbursement',
      );
    }
  }

  async getDisbursement(id: string) {
    const disbursement = await this.prisma.disbursement.findUnique({
      where: { id },
      include: {
        loan: {
          include: {
            schedules: true,
            payments: true,
          },
        },
      },
    });

    if (!disbursement) {
      throw new BadRequestException('Disbursement not found');
    }

    return disbursement;
  }

  async rollbackDisbursement(
    disbursementId: string,
    payload: RollbackDisbursementDto,
  ) {
    const disbursement = await this.prisma.disbursement.findUnique({
      where: { id: disbursementId },
      include: { loan: true },
    });

    if (!disbursement) {
      throw new BadRequestException('Disbursement not found');
    }

    const reason = payload.reason ?? 'MANUAL_ROLLBACK';
    const eligible = await this.rollbacksService.canRollback(disbursementId);

    if (!eligible) {
      throw new BadRequestException('Disbursement is not eligible for rollback');
    }

    await this.rollbacksService.rollbackTransaction(
      disbursementId,
      reason,
      payload.performedBy,
    );

    return this.getDisbursement(disbursementId);
  }

  async getDisbursementAuditTrail(disbursementId: string) {
    return this.rollbacksService.getAuditTrail(disbursementId);
  }

  private async ensurePlatformFunds(
    tx: Prisma.TransactionClient,
    requestedAmount: number,
  ) 
  {
    const [incoming, outgoing] = await Promise.all([
      tx.payment.aggregate({ _sum: { amount: true } }),
      tx.disbursement.aggregate({ _sum: { amount: true } }),
    ]);

    const incomingTotal = Number(incoming._sum.amount ?? 0);
    const outgoingTotal = Number(outgoing._sum.amount ?? 0);
    const available = incomingTotal - outgoingTotal;

    if (requestedAmount > available) {
      throw new BadRequestException('Insufficient platform funds');
    }
  }

  private buildRepaymentSchedule(params: {
    loanId: string;
    amount: number;
    tenor: number;
    interestRate: number;
    firstPaymentDate: Date;
  }): RepaymentScheduleEntry[]
   {
    const { loanId, amount, tenor, interestRate, firstPaymentDate } = params;

    const monthlyRate = interestRate / 12 / 100;
    const monthlyPayment =
      monthlyRate === 0
        ? amount / tenor
        : (amount * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -tenor));

    let remainingPrincipal = amount;
    const schedule: RepaymentScheduleEntry[] = [];

    for (let i = 1; i <= tenor; i++) {
      const interestPortion =
        monthlyRate === 0 ? 0 : remainingPrincipal * monthlyRate;
      let principalPortion = monthlyPayment - interestPortion;

      if (i === tenor) {
        principalPortion = remainingPrincipal;
      }

      remainingPrincipal = Math.max(
        remainingPrincipal - principalPortion,
        0,
      );

      schedule.push({
        loanId,
        installmentNumber: i,
        dueDate: this.addMonths(firstPaymentDate, i - 1),
        principalAmount: principalPortion.toFixed(2),
        interestAmount: interestPortion.toFixed(2),
        status: 'PENDING',
      });
    }

    return schedule;
  }

  private addMonths(date: Date, months: number) {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() + months);
    return copy;
  }
}