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

  async recordRepayment(payload: CreateRepaymentDto) {
    await this.ensureLoanExists(payload.loanId);

    const paymentDate = payload.paymentDate ?? new Date();
    const daysLate = payload.daysLate ?? 0;
    const lateFeePaid = payload.lateFeePaid ?? 0;

    const payment = await this.prisma.payment.create({
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

    return payment;
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

  async calculateDueNow(loanId: string) {
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

    const totalDue = outstandingPrincipal + outstandingInterest;

    return {
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
      },
      installmentsDue: dueSchedules.map((schedule) => ({
        installmentNumber: schedule.installmentNumber,
        dueDate: schedule.dueDate,
        principalDue: Number(schedule.principalAmount),
        interestDue: Number(schedule.interestAmount),
        status: schedule.status,
      })),
      nextInstallment: nextInstallment
        ? {
            installmentNumber: nextInstallment.installmentNumber,
            dueDate: nextInstallment.dueDate,
            principalDue: Number(nextInstallment.principalAmount),
            interestDue: Number(nextInstallment.interestAmount),
          }
        : null,
    };
  }
}

