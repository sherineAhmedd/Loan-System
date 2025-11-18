import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuditService {
constructor(private readonly prisma: PrismaService) {}

  async getAuditLogsByLoanId(loanId: string) {
   //all audit logs related to this loan
    return this.prisma.auditLog.findMany({
      where: {
        metadata: {
          path: ['loanId'],
          equals: loanId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}