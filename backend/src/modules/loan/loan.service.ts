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
