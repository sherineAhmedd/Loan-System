import { Prisma } from '@prisma/client';
import { RollbacksService } from './rollback.service';
import { Decimal } from '@prisma/client/runtime/binary';


const fixedDate = new Date('2025-11-20T00:00:00.000Z');

describe('RollbacksService', () => {
  let service: RollbacksService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedDate);

    mockPrisma = {
      disbursement: {
        findUnique: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      rollbackRecord: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      repaymentSchedule: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new RollbacksService(mockPrisma);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns false from canRollback when no transaction exists', async () => {
    mockPrisma.disbursement.findUnique.mockResolvedValue(null);
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    const result = await service.canRollback('missing');

    expect(result).toBe(false);
    expect(mockPrisma.rollbackRecord.findFirst).not.toHaveBeenCalled();
  });

  it('allows rollback for completed disbursement without prior rollback record', async () => {
    const disbursement = {
      id: 'disb-1',
      loanId: 'loan-1',
      status: 'completed',
      rolledBackAt: null,
    };

    mockPrisma.disbursement.findUnique.mockResolvedValue(disbursement);
    mockPrisma.payment.findUnique.mockResolvedValue(null);
    mockPrisma.rollbackRecord.findFirst.mockResolvedValue(null);

    const result = await service.canRollback('disb-1');

    expect(result).toBe(true);
  });

  it('maps audit trail entries with metadata', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        transactionId: 'tx-1',
        operation: 'TEST_OP',
        userId: 'user-1',
        metadata: { foo: 'bar' },
        createdAt: fixedDate,
      },
    ]);

    const result = await service.getAuditTrail('tx-1');

    expect(result).toEqual([
      {
        id: 'audit-1',
        transactionId: 'tx-1',
        operation: 'TEST_OP',
        userId: 'user-1',
        metadata: { foo: 'bar' },
        createdAt: fixedDate,
      },
    ]);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { transactionId: 'tx-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('rolls back a repayment by creating a compensating payment entry', async () => {
   const paymentEntity = {
  id: 'payment-1',
  loanId: 'loan-1',
  amount: new Decimal(100),
  principalPaid: new Decimal(80),
  interestPaid: new Decimal(15),
  lateFeePaid: new Decimal(5),
  daysLate: 0,
  status: 'POSTED',
  rolledBackAt: null,
  createdAt: new Date('2025-10-01T00:00:00.000Z'),
};


    mockPrisma.disbursement.findUnique.mockResolvedValue(null);
    mockPrisma.payment.findUnique.mockResolvedValue(paymentEntity);
    mockPrisma.rollbackRecord.findFirst.mockResolvedValue(null);

    const tx = {
      payment: {
        update: jest.fn().mockResolvedValue({
          ...paymentEntity,
          status: 'rolled_back',
          rolledBackAt: fixedDate,
        }),
        create: jest.fn().mockResolvedValue({
          id: 'payment-comp',
          ...paymentEntity,
          amount: paymentEntity.amount.mul(-1),
        }),
      },
      rollbackRecord: {
        create: jest.fn().mockImplementation(async (args) => ({
          id: 'rollback-1',
          transactionId: args.data.transactionId,
          originalOperation: args.data.originalOperation,
          rollbackReason: args.data.rollbackReason,
          compensatingActions: args.data.compensatingActions,
          rolledBackBy: args.data.rolledBackBy,
          createdAt: fixedDate,
        })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(null),
      },
      repaymentSchedule: {
        deleteMany: jest.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation((callback: any) =>
      callback(tx),
    );

    const result = await service.rollbackTransaction(
      paymentEntity.id,
      'Partial payment error',
    );

    expect(result.transactionId).toBe(paymentEntity.id);
    expect(result.originalOperation).toBe('repayment');
    expect(result.compensatingActions).toHaveLength(2);
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: paymentEntity.id },
      data: { status: 'rolled_back', rolledBackAt: fixedDate },
    });
    expect(tx.payment.create).toHaveBeenCalled();
    const createArgs = tx.payment.create.mock.calls[0][0];
    expect(createArgs.data.amount.toString()).toBe('-100');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('uses provided performer when rolling back a disbursement', async () => {
    const disbursement = {
      id: 'disb-1',
      loanId: 'loan-99',
      status: 'completed',
      rolledBackAt: null,
    };

    mockPrisma.disbursement.findUnique.mockResolvedValue(disbursement);
    mockPrisma.payment.findUnique.mockResolvedValue(null);
    mockPrisma.rollbackRecord.findFirst.mockResolvedValue(null);

    const tx = {
      repaymentSchedule: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      disbursement: {
        update: jest.fn().mockResolvedValue({
          ...disbursement,
          status: 'rolled_back',
          rolledBackAt: fixedDate,
        }),
      },
      rollbackRecord: {
        create: jest.fn().mockResolvedValue({
          transactionId: disbursement.id,
          originalOperation: 'disbursement',
          rollbackReason: 'Manual correction',
          compensatingActions: [],
          rolledBackBy: 'ops-user',
          createdAt: fixedDate,
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(null),
      },
      payment: {
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation((callback: any) =>
      callback(tx),
    );

    const record = await service.rollbackTransaction(
      disbursement.id,
      'Manual correction',
      'ops-user',
    );

    expect(record.rolledBackBy).toBe('ops-user');
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'ops-user',
      }),
    });
  });
});
