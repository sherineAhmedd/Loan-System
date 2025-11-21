import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { DisbursementService } from './disbursement.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDisbursementDto } from './dto/create-disbursement.dto';
import { RollbacksService } from '../rollback/rollback.service';

describe('DisbursementService', () => {
  let service: DisbursementService;
  let prisma: PrismaService;
  let loggerErrorSpy: jest.SpyInstance;

  const mockPrismaService = {
    loan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    disbursement: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    repaymentSchedule: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    rollbackRecord: {
      create: jest.fn(),
    },
  };

  const mockRollbacksService = {
    rollbackTransaction: jest.fn(),
    canRollback: jest.fn(),
    getAuditTrail: jest.fn(),
  };

  const mockLoanData = {
    id: 'loan-123',
    borrowerId: 'borrower-456',
    amount: 10000,
    interestRate: 12,
    tenor: 12,
    status: 'APPROVED',
    createdAt: new Date(),
    updatedAt: new Date(),
    disbursement: null,
  };

  const mockDisbursementDto: CreateDisbursementDto = {
    loanId: 'loan-123',
    borrowerId: 'borrower-456',
    amount: 10000,
    currency: 'USD',
    disbursementDate: new Date('2024-01-01'),
    firstPaymentDate: new Date('2024-02-01'),
    tenor: 12,
    interestRate: 12,
    status: 'pending',
  };

  beforeEach(async () => {
    // Mock Logger to suppress error logs during tests
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisbursementService,
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

    service = module.get<DisbursementService>(DisbursementService);
    prisma = module.get<PrismaService>(PrismaService);
    mockRollbacksService.canRollback.mockResolvedValue(true);
    mockRollbacksService.rollbackTransaction.mockResolvedValue({
      transactionId: 'disbursement-1',
      originalOperation: 'disbursement',
      rollbackReason: 'reason',
      rollbackTimestamp: new Date(),
      compensatingActions: [],
      rolledBackBy: 'system',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerErrorSpy.mockRestore();
  });

  describe('createDisbursement', () => {
    it('should successfully disburse a loan', async () => {
      // Mock loan lookup
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      // Mock transaction with all required operations
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              loanId: mockLoanData.id,
              amount: mockDisbursementDto.amount,
              disbursementDate: mockDisbursementDto.disbursementDate,
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              loanId: mockLoanData.id,
              amount: mockDisbursementDto.amount,
              disbursementDate: mockDisbursementDto.disbursementDate,
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 50000 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockResolvedValue({ count: 12 }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({
              id: 'audit-123',
              transactionId: 'disbursement-789',
              operation: 'LOAN_DISBURSEMENT',
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.createDisbursement(mockDisbursementDto);

      expect(result.status).toBe('completed');
      expect(mockPrismaService.loan.findUnique).toHaveBeenCalledWith({
        where: { id: mockDisbursementDto.loanId },
        include: { disbursement: true },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if loan not found', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(null);

      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow('Loan not found');

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if loan is not approved', async () => {
      const pendingLoan = { ...mockLoanData, status: 'PENDING' };
      mockPrismaService.loan.findUnique.mockResolvedValue(pendingLoan);

      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow('Only approved loans can be disbursed');

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if loan already disbursed (idempotency check)', async () => {
      const loanWithDisbursement = {
        ...mockLoanData,
        disbursement: {
          id: 'existing-disbursement',
          status: 'completed',
        },
      };
      mockPrismaService.loan.findUnique.mockResolvedValue(
        loanWithDisbursement,
      );

      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow('This loan has already been disbursed');

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for insufficient platform funds', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 50000 },
            }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 50000 }, // Available = 50000 - 50000 = 0
            }),
          },
        };
        // This will throw in ensurePlatformFunds
        return callback(tx);
      });

      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow('Insufficient platform funds');
    });

    it('should create rollback record on transaction failure', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      const transactionError = new Error('Database connection failed');
      mockPrismaService.$transaction.mockRejectedValue(transactionError);

      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.rollbackRecord.create).toHaveBeenCalledWith({
        data: {
          transactionId: mockDisbursementDto.loanId,
          originalOperation: 'CREATE_DISBURSEMENT',
          rollbackReason: transactionError.message,
          compensatingActions: {
            loanId: mockDisbursementDto.loanId,
            attemptedAmount: mockDisbursementDto.amount,
          },
        },
      });
    });

    it('should generate repayment schedule correctly', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      let capturedScheduleData: any[] = [];

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              loanId: mockLoanData.id,
              amount: mockDisbursementDto.amount,
              disbursementDate: mockDisbursementDto.disbursementDate,
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 0 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockImplementation((args) => {
              capturedScheduleData = args.data;
              return Promise.resolve({ count: args.data.length });
            }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await service.createDisbursement(mockDisbursementDto);

      expect(capturedScheduleData).toHaveLength(12);
      expect(capturedScheduleData[0]).toMatchObject({
        loanId: mockLoanData.id,
        installmentNumber: 1,
        status: 'PENDING',
      });
      expect(capturedScheduleData[0].principalAmount).toBeDefined();
      expect(capturedScheduleData[0].interestAmount).toBeDefined();
      expect(capturedScheduleData[0].dueDate).toBeInstanceOf(Date);
      expect(capturedScheduleData[11].installmentNumber).toBe(12);
    });

    it('should handle zero interest rate correctly', async () => {
      const zeroInterestDto = {
        ...mockDisbursementDto,
        interestRate: 0,
      };

      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      let capturedScheduleData: any[] = [];

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 0 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockImplementation((args) => {
              capturedScheduleData = args.data;
              return Promise.resolve({ count: args.data.length });
            }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await service.createDisbursement(zeroInterestDto);

      // With zero interest, all installments should have zero interest amount
      capturedScheduleData.forEach((installment) => {
        expect(parseFloat(installment.interestAmount)).toBe(0);
      });
    });

    it('should create audit log entry', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      let capturedAuditData: any;

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 0 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockResolvedValue({ count: 12 }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockImplementation((args) => {
              capturedAuditData = args.data;
              return Promise.resolve({});
            }),
          },
        };
        return callback(tx);
      });

      await service.createDisbursement(mockDisbursementDto);

      expect(capturedAuditData).toMatchObject({
        transactionId: 'disbursement-789',
        operation: 'LOAN_DISBURSEMENT',
        metadata: {
          loanId: mockLoanData.id,
          borrowerId: mockDisbursementDto.borrowerId,
          amount: mockDisbursementDto.amount,
          currency: mockDisbursementDto.currency,
          tenor: mockDisbursementDto.tenor,
        },
      });
    });

    it('should use provided status or default to pending', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      let capturedDisbursementData: any;

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockImplementation((args) => {
              capturedDisbursementData = args.data;
              return Promise.resolve({
                id: 'disbursement-789',
                ...args.data,
              });
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 0 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockResolvedValue({ count: 12 }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // Test with provided status
      await service.createDisbursement(mockDisbursementDto);
      expect(capturedDisbursementData.status).toBe('pending');

      // Test without status (should default to pending)
      const dtoWithoutStatus = { ...mockDisbursementDto };
      delete dtoWithoutStatus.status;
      await service.createDisbursement(dtoWithoutStatus);
      expect(capturedDisbursementData.status).toBe('pending');
    });

    it('should handle transaction rollback on partial failure', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockRejectedValue(
              new Error('Update failed'),
            ),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 0 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockResolvedValue({ count: 12 }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.rollbackRecord.create).toHaveBeenCalled();
    });
  });

  describe('getDisbursement', () => {
    const mockDisbursement = {
      id: 'disbursement-123',
      loanId: 'loan-123',
      amount: 10000,
      disbursementDate: new Date('2024-01-01'),
      status: 'completed',
      createdAt: new Date(),
      loan: {
        id: 'loan-123',
        schedules: [],
        payments: [],
      },
    };

    it('should return disbursement with loan details', async () => {
      mockPrismaService.disbursement.findUnique.mockResolvedValue(
        mockDisbursement,
      );

      const result = await service.getDisbursement('disbursement-123');

      expect(result).toEqual(mockDisbursement);
      expect(mockPrismaService.disbursement.findUnique).toHaveBeenCalledWith({
        where: { id: 'disbursement-123' },
        include: {
          loan: {
            include: {
              schedules: true,
              payments: true,
            },
          },
        },
      });
    });

    it('should throw BadRequestException if disbursement not found', async () => {
      mockPrismaService.disbursement.findUnique.mockResolvedValue(null);

      await expect(service.getDisbursement('non-existent')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getDisbursement('non-existent')).rejects.toThrow(
        'Disbursement not found',
      );
    });
  });

  describe('rollbackDisbursement', () => {
    const existingDisbursement = {
      id: 'disbursement-1',
      loanId: 'loan-123',
      amount: 1000,
      status: 'completed',
      loan: {
        id: 'loan-123',
        borrowerId: 'borrower-1',
      },
    };

    it('should rollback a completed disbursement', async () => {
      const rolledBackSnapshot = {
        ...existingDisbursement,
        status: 'rolled_back',
      };

      mockPrismaService.disbursement.findUnique
        .mockResolvedValueOnce(existingDisbursement)
        .mockResolvedValueOnce(rolledBackSnapshot);

      mockRollbacksService.canRollback.mockResolvedValue(true);
      mockRollbacksService.rollbackTransaction.mockResolvedValue({
        transactionId: existingDisbursement.id,
        originalOperation: 'disbursement',
        rollbackReason: 'Duplicate disbursement',
        rollbackTimestamp: new Date(),
        compensatingActions: [],
        rolledBackBy: 'user-1',
      });

      const result = await service.rollbackDisbursement('disbursement-1', {
        reason: 'Duplicate disbursement',
        performedBy: 'user-1',
      });

      expect(mockRollbacksService.canRollback).toHaveBeenCalledWith(
        'disbursement-1',
      );
      expect(mockRollbacksService.rollbackTransaction).toHaveBeenCalledWith(
        'disbursement-1',
        'Duplicate disbursement',
        'user-1',
      );
      expect(result).toEqual(rolledBackSnapshot);
    });

    it('should throw if disbursement not found', async () => {
      mockPrismaService.disbursement.findUnique.mockResolvedValue(null);

      await expect(
        service.rollbackDisbursement('missing', {}),
      ).rejects.toThrow(BadRequestException);
      expect(mockRollbacksService.canRollback).not.toHaveBeenCalled();
    });

    it('should prevent rolling back when not eligible', async () => {
      mockPrismaService.disbursement.findUnique.mockResolvedValue(
        existingDisbursement,
      );
      mockRollbacksService.canRollback.mockResolvedValue(false);

      await expect(
        service.rollbackDisbursement('disbursement-1', {}),
      ).rejects.toThrow('Disbursement is not eligible for rollback');
      expect(mockRollbacksService.rollbackTransaction).not.toHaveBeenCalled();
    });
  });

  describe('ensurePlatformFunds (private method)', () => {
    it('should pass when sufficient funds are available', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 50000 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockResolvedValue({ count: 12 }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 }, // Available = 100000 - 50000 = 50000 > 10000
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.createDisbursement(mockDisbursementDto);
      expect(result.status).toBe('completed');
    });

    it('should pass when requested amount equals available funds', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 50000 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockResolvedValue({ count: 12 }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 60000 }, // Available = 60000 - 50000 = 10000 (exact match)
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // Should work since 10000 <= 10000 (amount equals available)
      const result = await service.createDisbursement(mockDisbursementDto);
      expect(result.status).toBe('completed');
    });

    it('should handle null aggregate sums correctly', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: null }, // No disbursements yet
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockResolvedValue({ count: 12 }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: null }, // No payments yet
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      // Should fail because available = 0 - 0 = 0 < 10000
      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDisbursement(mockDisbursementDto),
      ).rejects.toThrow('Insufficient platform funds');
    });
  });

  describe('buildRepaymentSchedule (private method)', () => {
    it('should calculate correct monthly payment amounts', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      let capturedScheduleData: any[] = [];

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 0 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockImplementation((args) => {
              capturedScheduleData = args.data;
              return Promise.resolve({ count: args.data.length });
            }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await service.createDisbursement(mockDisbursementDto);

      // Verify schedule structure
      expect(capturedScheduleData.length).toBe(12);
      
      // First installment should have interest
      const firstInstallment = capturedScheduleData[0];
      expect(parseFloat(firstInstallment.principalAmount)).toBeGreaterThan(0);
      expect(parseFloat(firstInstallment.interestAmount)).toBeGreaterThan(0);
      expect(firstInstallment.installmentNumber).toBe(1);
      expect(firstInstallment.status).toBe('PENDING');

      // Last installment should have remaining principal
      const lastInstallment = capturedScheduleData[11];
      expect(lastInstallment.installmentNumber).toBe(12);
      
      // Verify due dates are sequential
      for (let i = 1; i < capturedScheduleData.length; i++) {
        const current = new Date(capturedScheduleData[i].dueDate);
        const previous = new Date(capturedScheduleData[i - 1].dueDate);
        expect(current.getTime()).toBeGreaterThan(previous.getTime());
      }
    });

    it('should handle single month tenor', async () => {
      const singleMonthDto = {
        ...mockDisbursementDto,
        tenor: 1,
      };

      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoanData);

      let capturedScheduleData: any[] = [];

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          disbursement: {
            create: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'pending',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'disbursement-789',
              status: 'completed',
              loan: mockLoanData,
            }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 0 },
            }),
          },
          repaymentSchedule: {
            createMany: jest.fn().mockImplementation((args) => {
              capturedScheduleData = args.data;
              return Promise.resolve({ count: args.data.length });
            }),
          },
          payment: {
            aggregate: jest.fn().mockResolvedValue({
              _sum: { amount: 100000 },
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      await service.createDisbursement(singleMonthDto);

      expect(capturedScheduleData.length).toBe(1);
      expect(capturedScheduleData[0].installmentNumber).toBe(1);
    });
  });
});

