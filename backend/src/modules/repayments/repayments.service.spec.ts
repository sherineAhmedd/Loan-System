import { Test, TestingModule } from '@nestjs/testing';
import { RepaymentsService } from './repayments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { RollbacksService } from '../rollback/rollback.service';

describe('RepaymentsService', () => {
  let service: RepaymentsService;
  const mockLoanId = '11111111-1111-1111-1111-111111111111';
  const borrowerId = 'borrower-1';
  const buildLoan = () => ({
    id: mockLoanId,
    borrowerId,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    interestRate: 12,
    amount: 1000,
  });

  const mockPrismaService = {
    loan: {
      findUnique: jest.fn(),
    },
    repaymentSchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockRollbacksService = {
    rollbackTransaction: jest.fn(),
    canRollback: jest.fn(),
    getAuditTrail: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-15T00:00:00Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RollbacksService,
          useValue: mockRollbacksService,
        },
      ],
    }).compile();

    service = module.get<RepaymentsService>(RepaymentsService);

    mockPrismaService.$transaction.mockImplementation((handler: any) =>
      handler({
        payment: mockPrismaService.payment,
        repaymentSchedule: mockPrismaService.repaymentSchedule,
        auditLog: mockPrismaService.auditLog,
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should throw when loan not found', async () => {
    mockPrismaService.loan.findUnique.mockResolvedValue(null);

    await expect(service.calculateDueNow('missing')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should record a repayment', async () => {
    mockPrismaService.loan.findUnique.mockResolvedValue(buildLoan());
    mockPrismaService.payment.aggregate.mockResolvedValue({
      _sum: { principalPaid: 0 },
    });
    mockPrismaService.payment.findFirst.mockResolvedValue(null);
    mockPrismaService.repaymentSchedule.findFirst.mockResolvedValue(null);
    mockPrismaService.auditLog.create.mockResolvedValue(null);

    const payload = {
      loanId: mockLoanId,
      amount: 200,
      principalPaid: 150,
      interestPaid: 50,
    };

    const created = { id: 'payment-1', ...payload };
    mockPrismaService.payment.create.mockResolvedValue(created);

    const result = await service.recordRepayment(payload as any);

    expect(result).toEqual(created);
    expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loanId: payload.loanId,
        }),
      }),
    );
  });

  it("should return what's due now", async () => {
    mockPrismaService.loan.findUnique.mockResolvedValue(buildLoan());

    mockPrismaService.repaymentSchedule.findMany.mockResolvedValue([
      {
        installmentNumber: 1,
        dueDate: new Date('2024-12-15T00:00:00Z'),
        principalAmount: '500.00',
        interestAmount: '50.00',
        status: 'PENDING',
      },
      {
        installmentNumber: 2,
        dueDate: new Date('2025-01-10T00:00:00Z'),
        principalAmount: '500.00',
        interestAmount: '40.00',
        status: 'PARTIALLY_PAID',
      },
    ]);

    mockPrismaService.payment.aggregate.mockResolvedValue({
      _sum: {
        principalPaid: '300.00',
        interestPaid: '20.00',
        lateFeePaid: '10.00',
      },
    });

    mockPrismaService.repaymentSchedule.findFirst.mockResolvedValue({
      installmentNumber: 3,
      dueDate: new Date('2025-02-10T00:00:00Z'),
      principalAmount: '500.00',
      interestAmount: '30.00',
    });

    const result = await service.calculateDueNow(mockLoanId);

    expect(result.summary).toMatchObject({
      overdueInstallments: 2,
      principalDue: 700, // (500+500) - 300
      interestDue: 70, // (50+40) - 20
      totalDue: 770,
      totalPaidLateFees: 10,
    });

    expect(result.installmentsDue).toHaveLength(2);
    expect(result.nextInstallment).toMatchObject({
      installmentNumber: 3,
    });

    expect(mockPrismaService.repaymentSchedule.findMany).toHaveBeenCalled();
  });

  it('should return payment history', async () => {
    mockPrismaService.loan.findUnique.mockResolvedValue(buildLoan());

    const history = [{ id: 'payment-1' }];
    mockPrismaService.payment.findMany.mockResolvedValue(history);

    const result = await service.getPaymentHistory(mockLoanId);

    expect(result).toEqual(history);
    expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
      where: { loanId: mockLoanId },
      orderBy: { paymentDate: 'desc' },
    });
  });

  it('should return repayment schedule', async () => {
    mockPrismaService.loan.findUnique.mockResolvedValue(buildLoan());

    const schedule = [{ installmentNumber: 1 }];
    mockPrismaService.repaymentSchedule.findMany.mockResolvedValue(schedule);

    const result = await service.getRepaymentSchedule(mockLoanId);

    expect(result).toEqual(schedule);
    expect(mockPrismaService.repaymentSchedule.findMany).toHaveBeenCalledWith({
      where: { loanId: mockLoanId },
      orderBy: { installmentNumber: 'asc' },
    });
  });

  it('rolls back a repayment transaction through rollback service', async () => {
    mockRollbacksService.canRollback.mockResolvedValue(true);
    mockRollbacksService.rollbackTransaction.mockResolvedValue({
      transactionId: 'payment-1',
      originalOperation: 'repayment',
      rollbackReason: 'Duplicate payment',
      rollbackTimestamp: new Date(),
      compensatingActions: [],
      rolledBackBy: 'agent-1',
    });

    const result = await service.rollbackRepaymentTransaction(
      'payment-1',
      'Duplicate payment',
      { sub: 'agent-1' },
    );

    expect(mockRollbacksService.canRollback).toHaveBeenCalledWith('payment-1');
    expect(mockRollbacksService.rollbackTransaction).toHaveBeenCalledWith(
      'payment-1',
      'Duplicate payment',
      'agent-1',
    );
    expect(result.transactionId).toBe('payment-1');
  });

  it('throws when repayment cannot be rolled back', async () => {
    mockRollbacksService.canRollback.mockResolvedValue(false);

    await expect(
      service.rollbackRepaymentTransaction('payment-1', 'reason'),
    ).rejects.toThrow('Repayment is not eligible for rollback');
    expect(mockRollbacksService.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('retrieves repayment audit trail from rollback service', async () => {
    mockRollbacksService.getAuditTrail.mockResolvedValue([
      { id: 'audit-123' },
    ] as any);

    const logs = await service.getRepaymentAuditTrail('payment-1');

    expect(mockRollbacksService.getAuditTrail).toHaveBeenCalledWith(
      'payment-1',
    );
    expect(logs).toEqual([{ id: 'audit-123' }]);
  });
});

