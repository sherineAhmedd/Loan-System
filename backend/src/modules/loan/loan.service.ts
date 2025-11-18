import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type ListParams = {
  q?: string;
  borrowerId?: string;
  page?: number;
  perPage?: number;
};

@Injectable()
export class LoanService {
  constructor(private readonly prisma: PrismaService) {}

  async listLoans(params: ListParams) {
    const page = Math.max(1, Number(params.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(params.perPage ?? 25)));
    const skip = (page - 1) * perPage;

    const where: Prisma.LoanWhereInput = {};

    if (params.borrowerId) {
      where.borrowerId = params.borrowerId;
    }

    if (params.q) {
      where.OR = [
        { id: { contains: params.q, mode: 'insensitive' } },
        { borrowerId: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.loan.count({ where }),
      this.prisma.loan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
    ]);

    return {
      data,
      total,
      page,
      perPage,
    };
  }

  // Get loan by ID
  async getLoanById(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { disbursement: true, schedules: true, payments: true },
    });
    if (!loan) throw new BadRequestException('Loan not found');
    return loan;
  }
}
