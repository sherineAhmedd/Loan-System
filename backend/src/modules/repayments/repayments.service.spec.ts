import { Test, TestingModule } from '@nestjs/testing';
import { RepaymentsService } from './repayments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('RepaymentsService', () => {
  let service: RepaymentsService;

  const mockPrismaService = {
    loan: {
      findUnique: jest.fn(),
    },
    repaymentSchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
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
      ],
    }).compile();

    service = module.get<RepaymentsService>(RepaymentsService);
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
    mockPrismaService.loan.findUnique.mockResolvedValue({
      id: 'loan-1',
      borrowerId: 'borrower-1',
      status: 'ACTIVE',
    });

    const payload = {
      loanId: 'loan-1',
      amount: 200,
      principalPaid: 150,
      interestPaid: 50,
    };

    const created = { id: 'payment-1', ...payload };
    mockPrismaService.payment.create.mockResolvedValue(created);

    const result = await service.recordRepayment(payload as any);

    expect(result).toEqual(created);
    expect(mockPrismaService.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loanId: payload.loanId,
        amount: payload.amount,
        principalPaid: payload.principalPaid,
        interestPaid: payload.interestPaid,
      }),
    });
  });

  it("should return what's due now", async () => {
    mockPrismaService.loan.findUnique.mockResolvedValue({
      id: 'loan-1',
      borrowerId: 'borrower-1',
      status: 'ACTIVE',
    });

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

    const result = await service.calculateDueNow('loan-1');

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
    mockPrismaService.loan.findUnique.mockResolvedValue({
      id: 'loan-1',
      borrowerId: 'borrower-1',
      status: 'ACTIVE',
    });

    const history = [{ id: 'payment-1' }];
    mockPrismaService.payment.findMany.mockResolvedValue(history);

    const result = await service.getPaymentHistory('loan-1');

    expect(result).toEqual(history);
    expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
      where: { loanId: 'loan-1' },
      orderBy: { paymentDate: 'desc' },
    });
  });

  it('should return repayment schedule', async () => {
    mockPrismaService.loan.findUnique.mockResolvedValue({
      id: 'loan-1',
      borrowerId: 'borrower-1',
      status: 'ACTIVE',
    });

    const schedule = [{ installmentNumber: 1 }];
    mockPrismaService.repaymentSchedule.findMany.mockResolvedValue(schedule);

    const result = await service.getRepaymentSchedule('loan-1');

    expect(result).toEqual(schedule);
    expect(mockPrismaService.repaymentSchedule.findMany).toHaveBeenCalledWith({
      where: { loanId: 'loan-1' },
      orderBy: { installmentNumber: 'asc' },
    });
  });
});

