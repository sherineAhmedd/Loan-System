import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { Decimal } from '@prisma/client/runtime/binary';
import {
  InstallmentDue,
  LateFeeCalculation,
  RepaymentCalculationResult,
} from './interface/repayment-calculation.interface';
import { RollbacksService } from '../rollback/rollback.service';

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rollbacksService: RollbacksService,
  ) {}

  private toNumberSafe(value: Decimal | number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (value instanceof Decimal) return value.toNumber();
    return 0;
  }

  private toDecimalSafe(value: number | string | Decimal | null | undefined): Decimal {
    if (value instanceof Decimal) return value;
    return new Decimal(value ?? 0);
  }

  private assertValidLoanId(loanId: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!loanId || !uuidRegex.test(loanId)) {
      throw new BadRequestException('loanId must be a valid UUID');
    }
  }

  private async ensureLoanExists(loanId: string) {
    this.assertValidLoanId(loanId);
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        borrowerId: true,
        status: true,
        createdAt: true,
        interestRate: true,
        amount: true,
      },
    });

    if (!loan) {
      throw new BadRequestException('Loan not found');
    }

    return loan;
  }
//record repayemnt
  async recordRepayment(payload: CreateRepaymentDto, user: any) {
    this.assertValidLoanId(payload.loanId);
    const loan = await this.ensureLoanExists(payload.loanId);
    const paymentDate = payload.paymentDate ? new Date(payload.paymentDate) : new Date();
    const paymentAmount = payload.amount;

    const lastPayment = await this.prisma.payment.findFirst({
      where: { loanId: payload.loanId },
      orderBy: { paymentDate: 'desc' },
    });

    const lastPaymentDate = new Date(lastPayment?.paymentDate ?? loan.createdAt);
    const msPerDay = 1000 * 60 * 60 * 24;
    let daysSinceLastPayment = Math.floor((paymentDate.getTime() - lastPaymentDate.getTime()) / msPerDay);
    daysSinceLastPayment = Math.max(daysSinceLastPayment, 1); // always at least 1 day
    const dailyInterestRate = this.toNumberSafe(loan.interestRate) / 100 / 365;

    const aggregate = await this.prisma.payment.aggregate({
      where: { loanId: payload.loanId },
      _sum: { principalPaid: true },
    });

    const totalPrincipalPaid = this.toNumberSafe(aggregate._sum.principalPaid ?? 0);
    const principalRemaining = this.toNumberSafe(loan.amount) - totalPrincipalPaid;
    const accruedInterest = parseFloat((principalRemaining * dailyInterestRate * daysSinceLastPayment).toFixed(2));

    let daysLate = payload.daysLate ?? 0;
    if (daysLate === 0) {
      const nextSchedule = await this.prisma.repaymentSchedule.findFirst({
        where: { loanId: payload.loanId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { dueDate: 'asc' },
      });
      if (nextSchedule && paymentDate > nextSchedule.dueDate) {
        const rawDaysLate = Math.floor((paymentDate.getTime() - nextSchedule.dueDate.getTime()) / msPerDay);
        daysLate = Math.max(0, rawDaysLate - 3);
      }
    }

  let lateFeePortion = payload.lateFeePaid ?? 0;
    if (lateFeePortion === 0 && daysLate > 3) {
       lateFeePortion = 25;
       } else if (lateFeePortion === 0 && daysLate > 0) {
     const rate = 0.01;
     const maxRate = 0.10;
     const effectiveDays = Math.min(daysLate, 10);
     lateFeePortion = Math.min(paymentAmount * rate * effectiveDays, paymentAmount * maxRate);
    }

    const interestPortion = accruedInterest; 
    const amountAfterInterestAndFees = paymentAmount - interestPortion - lateFeePortion;

    if (amountAfterInterestAndFees < 0) {
      throw new BadRequestException('Payment must cover interest and late fees before principal');
    }

    const desiredPrincipal = payload.principalPaid ?? parseFloat(amountAfterInterestAndFees.toFixed(2));
    const finalPrincipalPortion = parseFloat(Math.max(0, Math.min(principalRemaining, desiredPrincipal)).toFixed(2));
    const finalInterestPortion = parseFloat(Math.min(interestPortion, paymentAmount).toFixed(2));
    const finalLateFeePortion = parseFloat(Math.min(lateFeePortion, paymentAmount - finalInterestPortion).toFixed(2));
    
    console.log({
  principalRemaining,
  accruedInterest,
  daysSinceLastPayment,
  interestPortion,
  finalPrincipalPortion,
  finalInterestPortion,
  finalLateFeePortion
});
    const userId = user?.sub || user?.service || 'system';
    const serviceName = user?.service || 'system';

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            loanId: payload.loanId,
            amount: this.toDecimalSafe(paymentAmount),
            paymentDate,
            principalPaid: this.toDecimalSafe(finalPrincipalPortion),
            interestPaid: this.toDecimalSafe(finalInterestPortion),
            lateFeePaid: this.toDecimalSafe(finalLateFeePortion),
            daysLate,
            status: payload.status ?? 'POSTED',
          },
        });

        const schedule = await tx.repaymentSchedule.findFirst({
          where: { loanId: payload.loanId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
          orderBy: { dueDate: 'asc' },
        });

        if (schedule) {
          const totalDue = this.toNumberSafe(schedule.principalAmount) + this.toNumberSafe(schedule.interestAmount);
          const remaining = totalDue - (finalPrincipalPortion + finalInterestPortion);
          await tx.repaymentSchedule.update({
            where: { id: schedule.id },
            data: {
              status: remaining <= 0 ? 'PAID' : 'PARTIALLY_PAID',
              paidDate: remaining <= 0 ? paymentDate : null,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            transactionId: payment.id,
            operation: 'REPAYMENT_CREATE',
            userId,
            metadata: {
              loanId: payload.loanId,
              borrowerId: loan.borrowerId,
              paymentId: payment.id,
              amount: this.toDecimalSafe(paymentAmount),
              principalPaid: this.toDecimalSafe(finalPrincipalPortion),
              interestPaid: this.toDecimalSafe(finalInterestPortion),
              lateFeePaid: this.toDecimalSafe(finalLateFeePortion),
              daysLate,
              accruedInterestCalculated: this.toDecimalSafe(accruedInterest),
              totalPaid: this.toDecimalSafe(paymentAmount),
              principalRemainingBeforePayment: this.toDecimalSafe(principalRemaining),
              paymentDate,
              status: payload.status ?? 'POSTED',
              performedBy: { userId, service: serviceName },
              timestamp: new Date().toISOString(),
            },
          },
        });

        return payment;
      });

      return result;
      //i need it as i was got internal server 500 error 
    } catch (err) {
      
      if (err instanceof BadRequestException) {
        throw err;
      }

      // Log the full error for debugging
      console.error(' recordRepayment error:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
        code: err?.code,
      });

      // For Prisma errors, provide more context
      if (err?.code === 'P2002') {
        throw new BadRequestException('A payment with this information already exists');
      }
      if (err?.code === 'P2003') {
        throw new BadRequestException('Invalid loan reference');
      }

      // For other errors, wrap with more context
      throw new BadRequestException(
        `Failed to record repayment: ${err?.message || 'Unknown error'}. Please check the loanId is a valid UUID and the loan exists.`,
      );
    }
  }

  async getPaymentHistory(loanId: string) {
    this.assertValidLoanId(loanId);
    await this.ensureLoanExists(loanId);

    return this.prisma.payment.findMany({
      where: { loanId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getRepaymentSchedule(loanId: string) {
    this.assertValidLoanId(loanId);
    await this.ensureLoanExists(loanId);

    return this.prisma.repaymentSchedule.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
    });
  }

  async calculateDueNow(
    loanId: string,
    user: any,
  ): Promise<RepaymentCalculationResult> {
    this.assertValidLoanId(loanId);
    const loan = await this.ensureLoanExists(loanId);

    const now = new Date();

    const [dueSchedules, paymentSums, nextInstallment] = await Promise.all([
      this.prisma.repaymentSchedule.findMany({
        where: {
          loanId,
          dueDate: { lte: now },
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        orderBy: { installmentNumber: 'asc' },
      }),
      this.prisma.payment.aggregate({
        where: { loanId },
        _sum: {
          principalPaid: true,
          interestPaid: true,
          lateFeePaid: true,
        },
      }),
      this.prisma.repaymentSchedule.findFirst({
        where: {
          loanId,
          dueDate: { gt: now },
          status: 'PENDING',
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const sumDecimalArray = (values: Array<Decimal | number | string>) =>
      values.reduce<number>((total, value) => total + this.toNumberSafe(value), 0);

    const duePrincipal = sumDecimalArray(
      dueSchedules.map((schedule) => schedule.principalAmount as Decimal),
    );
    const dueInterest = sumDecimalArray(
      dueSchedules.map((schedule) => schedule.interestAmount as Decimal),
    );

    const paidPrincipal = this.toNumberSafe(paymentSums._sum.principalPaid ?? 0);
    const paidInterest = this.toNumberSafe(paymentSums._sum.interestPaid ?? 0);
    const paidLateFees = this.toNumberSafe(paymentSums._sum.lateFeePaid ?? 0);

    const outstandingPrincipal = Math.max(duePrincipal - paidPrincipal, 0);
    const outstandingInterest = Math.max(dueInterest - paidInterest, 0);

    const lateFeeCalculations: LateFeeCalculation[] = dueSchedules.map((schedule) => {
      const daysLate = Math.floor(
        (now.getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const lateFeeRate = 0.01;
      const maxLateFeeRate = 0.1;
      const scheduleTotal =
        this.toNumberSafe(schedule.principalAmount) +
        this.toNumberSafe(schedule.interestAmount);
      const effectiveDays = Math.min(Math.max(daysLate, 0), 10);
      const calculatedLateFee =
        daysLate > 0
          ? Math.min(scheduleTotal * lateFeeRate * effectiveDays, scheduleTotal * maxLateFeeRate)
          : 0;

      return {
        installmentNumber: schedule.installmentNumber,
        dueDate: schedule.dueDate,
        daysLate,
        calculatedLateFee: Number(calculatedLateFee.toFixed(2)),
      };
    });

    const totalDue = outstandingPrincipal + outstandingInterest;
    const totalCalculatedLateFees = lateFeeCalculations.reduce(
      (sum, calc) => sum + calc.calculatedLateFee,
      0,
    );

    const userId = user?.sub || user?.service || 'system';
    const serviceName = user?.service || 'system';

    const calculationResult: RepaymentCalculationResult = {
      loanId: loan.id,
      borrowerId: loan.borrowerId,
      loanStatus: loan.status,
      asOfDate: now,
      summary: {
        overdueInstallments: dueSchedules.length,
        principalDue: Number(outstandingPrincipal.toFixed(2)),
        interestDue: Number(outstandingInterest.toFixed(2)),
        totalDue: Number(totalDue.toFixed(2)),
        totalPaidLateFees: Number(paidLateFees.toFixed(2)),
        totalCalculatedLateFees: Number(totalCalculatedLateFees.toFixed(2)),
      },
      installmentsDue: dueSchedules.map<InstallmentDue>((schedule) => ({
        installmentNumber: schedule.installmentNumber,
        dueDate: schedule.dueDate,
        principalDue: this.toNumberSafe(schedule.principalAmount),
        interestDue: this.toNumberSafe(schedule.interestAmount),
        status: schedule.status,
      })),
      lateFeeCalculations,
      nextInstallment: nextInstallment
        ? {
            installmentNumber: nextInstallment.installmentNumber,
            dueDate: nextInstallment.dueDate,
            principalDue: this.toNumberSafe(nextInstallment.principalAmount),
            interestDue: this.toNumberSafe(nextInstallment.interestAmount),
            status: nextInstallment.status,
          }
        : null,
    };

    const auditMetadata: Prisma.InputJsonObject = {
      loanId,
      borrowerId: loan.borrowerId,
      calculationDate: now.toISOString(),
      calculations: { ...calculationResult.summary },
      lateFeeCalculations: lateFeeCalculations.map((calc) => ({
        ...calc,
        dueDate: calc.dueDate.toISOString(),
      })),
      performedBy: {
        userId,
        service: serviceName,
      },
      timestamp: new Date().toISOString(),
    };

    await this.prisma.auditLog.create({
      data: {
        transactionId: loanId,
        operation: 'REPAYMENT_CALCULATION',
        userId,
        metadata: auditMetadata,
      },
    });

    return calculationResult;
  }

  async rollbackRepaymentTransaction(
    paymentId: string,
    reason: string,
    user?: any,
  ) {
    if (!paymentId) {
      throw new BadRequestException('paymentId is required');
    }

    const canRollback = await this.rollbacksService.canRollback(paymentId);

    if (!canRollback) {
      throw new BadRequestException('Repayment is not eligible for rollback');
    }

    const performer = user?.sub || user?.service || undefined;

    return this.rollbacksService.rollbackTransaction(paymentId, reason, performer);
  }

  async getRepaymentAuditTrail(paymentId: string) {
    return this.rollbacksService.getAuditTrail(paymentId);
  }
}
