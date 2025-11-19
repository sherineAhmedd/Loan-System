import { BadRequestException, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/binary';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';

@Injectable()
export class RepaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureLoanExists(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: { id: true, borrowerId: true, status: true },
    });

    if (!loan) {
      throw new BadRequestException('Loan not found');
    }

    return loan;
  }

  async recordRepayment(payload: CreateRepaymentDto, user: any) {
    const loan = await this.ensureLoanExists(payload.loanId);

    const paymentDate = payload.paymentDate ?? new Date();
    
    // Calculate days late if not provided
    let daysLate = payload.daysLate ?? 0;
    if (daysLate === 0) {
      const schedule = await this.prisma.repaymentSchedule.findFirst({
        where: { loanId: payload.loanId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        orderBy: { dueDate: 'asc' },
      });
      if (schedule && paymentDate > schedule.dueDate) {
        daysLate = Math.floor((paymentDate.getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    // Calculate late fee if not provided (example: 1% per day late, max 10%)
    let lateFeePaid = payload.lateFeePaid ?? 0;
    if (lateFeePaid === 0 && daysLate > 0) {
      const lateFeeRate = 0.01; // 1% per day
      const maxLateFeeRate = 0.10; // Max 10%
      const effectiveDays = Math.min(daysLate, 10); // Cap at 10 days for calculation
      lateFeePaid = payload.amount * lateFeeRate * effectiveDays;
      lateFeePaid = Math.min(lateFeePaid, payload.amount * maxLateFeeRate);
    }

    const userId = user?.sub || user?.service || 'system';
    const serviceName = user?.service || 'system';

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          loanId: payload.loanId,
          amount: payload.amount,
          paymentDate,
          principalPaid: payload.principalPaid,
          interestPaid: payload.interestPaid,
          lateFeePaid,
          daysLate,
          status: payload.status ?? 'POSTED',
        },
      });

      // Create comprehensive audit log for repayment creation
      await tx.auditLog.create({
        data: {
          transactionId: payment.id,
          operation: 'REPAYMENT_CREATE',
          userId: userId,
          metadata: {
            loanId: payload.loanId,
            borrowerId: loan.borrowerId,
            paymentId: payment.id,
            amount: payload.amount,
            principalPaid: payload.principalPaid,
            interestPaid: payload.interestPaid,
            lateFeePaid: lateFeePaid,
            lateFeeCalculated: payload.lateFeePaid === undefined || payload.lateFeePaid === 0,
            lateFeeCalculation: {
              daysLate: daysLate,
              rate: daysLate > 0 ? 0.01 : 0,
              calculatedAmount: lateFeePaid,
            },
            daysLate: daysLate,
            daysLateCalculated: payload.daysLate === undefined || payload.daysLate === 0,
            paymentDate: paymentDate,
            status: payload.status ?? 'POSTED',
            performedBy: {
              userId: userId,
              service: serviceName,
            },
            timestamp: new Date().toISOString(),
          },
        },
      });

      return payment;
    });

    return result;
  }

  async getPaymentHistory(loanId: string) {
    await this.ensureLoanExists(loanId);

    return this.prisma.payment.findMany({
      where: { loanId },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getRepaymentSchedule(loanId: string) {
    await this.ensureLoanExists(loanId);

    return this.prisma.repaymentSchedule.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
    });
  }

  async calculateDueNow(loanId: string, user: any) {
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

    const sumDecimalArray = <
      T extends string | number | Decimal | null | undefined
    >(
      values: T[],
    ): number => {
      return values.reduce((total, value) => {
        let num: number;

        if (value instanceof Decimal) {
          num = value.toNumber();
        } else {
          num = Number(value ?? 0);
        }

        return total + (isNaN(num) ? 0 : num);
      }, 0);
    };

    const duePrincipal = sumDecimalArray(
      dueSchedules.map((schedule) => schedule.principalAmount),
    );
    const dueInterest = sumDecimalArray(
      dueSchedules.map((schedule) => schedule.interestAmount),
    );

    const paidPrincipal = Number(paymentSums._sum.principalPaid ?? 0);
    const paidInterest = Number(paymentSums._sum.interestPaid ?? 0);
    const paidLateFees = Number(paymentSums._sum.lateFeePaid ?? 0);

    const outstandingPrincipal = Math.max(duePrincipal - paidPrincipal, 0);
    const outstandingInterest = Math.max(dueInterest - paidInterest, 0);

    // Calculate potential late fees for overdue installments
    const lateFeeCalculations = dueSchedules.map((schedule) => {
      const daysLate = Math.floor((now.getTime() - schedule.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const lateFeeRate = 0.01; // 1% per day
      const maxLateFeeRate = 0.10; // Max 10%
      const scheduleTotal = Number(schedule.principalAmount) + Number(schedule.interestAmount);
      const effectiveDays = Math.min(Math.max(daysLate, 0), 10);
      const calculatedLateFee = daysLate > 0 ? Math.min(scheduleTotal * lateFeeRate * effectiveDays, scheduleTotal * maxLateFeeRate) : 0;
      
      return {
        installmentNumber: schedule.installmentNumber,
        dueDate: schedule.dueDate,
        daysLate: daysLate,
        calculatedLateFee: Number(calculatedLateFee.toFixed(2)),
      };
    });

    const totalDue = outstandingPrincipal + outstandingInterest;
    const totalCalculatedLateFees = lateFeeCalculations.reduce((sum, calc) => sum + calc.calculatedLateFee, 0);

    const userId = user?.sub || user?.service || 'system';
    const serviceName = user?.service || 'system';

    const calculationResult = {
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
      installmentsDue: dueSchedules.map((schedule) => ({
        installmentNumber: schedule.installmentNumber,
        dueDate: schedule.dueDate,
        principalDue: Number(schedule.principalAmount),
        interestDue: Number(schedule.interestAmount),
        status: schedule.status,
      })),
      lateFeeCalculations: lateFeeCalculations,
      nextInstallment: nextInstallment
        ? {
            installmentNumber: nextInstallment.installmentNumber,
            dueDate: nextInstallment.dueDate,
            principalDue: Number(nextInstallment.principalAmount),
            interestDue: Number(nextInstallment.interestAmount),
          }
        : null,
    };

    // Log the calculation operation
    await this.prisma.auditLog.create({
      data: {
        transactionId: loanId,
        operation: 'REPAYMENT_CALCULATION',
        userId: userId,
        metadata: {
          loanId: loanId,
          borrowerId: loan.borrowerId,
          calculationDate: now,
          calculations: {
            principalDue: calculationResult.summary.principalDue,
            interestDue: calculationResult.summary.interestDue,
            totalDue: calculationResult.summary.totalDue,
            overdueInstallments: calculationResult.summary.overdueInstallments,
            lateFeeCalculations: lateFeeCalculations,
            totalCalculatedLateFees: calculationResult.summary.totalCalculatedLateFees,
            totalPaidLateFees: calculationResult.summary.totalPaidLateFees,
          },
          performedBy: {
            userId: userId,
            service: serviceName,
          },
          timestamp: new Date().toISOString(),
        },
      },
    });

    return calculationResult;
  }
}

