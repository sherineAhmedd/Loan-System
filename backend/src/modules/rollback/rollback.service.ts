import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditLog,
  Disbursement,
  Payment,
  Prisma,
  RollbackRecord as PrismaRollbackRecord,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AuditEntry,
  RollbackAction,
  RollbackOperation,
  RollbackRecord,
} from './interface/rollback-record.interface';

type TransactionContext =
  | { type: 'disbursement'; entity: Disbursement }
  | { type: 'repayment'; entity: Payment };

@Injectable()
export class RollbacksService {
  private readonly logger = new Logger(RollbacksService.name);
  private readonly systemActor = 'system';

  constructor(private readonly prisma: PrismaService) {}

  async rollbackTransaction(
transactionId: string, reason: string, performer: any,
  ): Promise<RollbackRecord> {
    if (!transactionId) {
      throw new BadRequestException('transactionId is required');
    }

    if (!reason?.trim()) {
      throw new BadRequestException('Rollback reason is required');
    }

    const context = await this.findTransaction(transactionId);

    if (!context) {
      throw new NotFoundException(
        `No disbursement or repayment found for transaction ${transactionId}`,
      );
    }

    const eligible = await this.canRollback(transactionId);

    if (!eligible) {
      throw new BadRequestException(
        'Transaction is not eligible for rollback',
      );
    }

    try {
      const record = await this.prisma.$transaction((tx) => {
        if (context.type === 'disbursement') {
          return this.rollbackDisbursement({
            tx,
            disbursement: context.entity,
            reason: reason.trim(),
          });
        }

        return this.rollbackRepayment({
          tx,
          payment: context.entity,
          reason: reason.trim(),
        });
      });

      return this.mapRollbackRecord(record);
    } catch (error) {
      this.logger.error(
        `Rollback failed for transaction ${transactionId}`,
        error?.stack,
      );

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(
        `Unable to rollback transaction: ${error?.message ?? 'Unknown error'}`,
      );
    }
  }

  async canRollback(transactionId: string): Promise<boolean> {
    const context = await this.findTransaction(transactionId);

    if (!context) {
      return false;
    }

    const existingRecord = await this.prisma.rollbackRecord.findFirst({
      where: { transactionId },
    });

    if (existingRecord) {
      return false;
    }

    if (context.type === 'disbursement') {
      return (
        context.entity.status === 'completed' && !context.entity.rolledBackAt
      );
    }

    return (
      context.entity.status !== 'rolled_back' && !context.entity.rolledBackAt
    );
  }

  async getAuditTrail(transactionId: string): Promise<AuditEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });

    return logs.map((log) => this.mapAuditEntry(log));
  }

  private async findTransaction(
    transactionId: string,
  ): Promise<TransactionContext | null> {
    const disbursement = await this.prisma.disbursement.findUnique({
      where: { id: transactionId },
    });

    if (disbursement) {
      return { type: 'disbursement', entity: disbursement };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: transactionId },
    });

    if (payment) {
      return { type: 'repayment', entity: payment };
    }

    return null;
  }

  private async rollbackDisbursement(params: {
    tx: Prisma.TransactionClient;
    disbursement: Disbursement;
    reason: string;
  }): Promise<PrismaRollbackRecord> {
    const { tx, disbursement, reason } = params;
    const now = new Date();
    const actions: RollbackAction[] = [];

    const deletedSchedules = await tx.repaymentSchedule.deleteMany({
      where: { loanId: disbursement.loanId },
    });

    actions.push({
      type: 'revert_repayment_schedule',
      description: 'Removed generated repayment schedules for loan',
      status: 'completed',
      metadata: {
        loanId: disbursement.loanId,
        removedCount: deletedSchedules.count,
      },
      timestamp: now,
    });

    const updatedDisbursement = await tx.disbursement.update({
      where: { id: disbursement.id },
      data: {
        status: 'rolled_back',
        rolledBackAt: now,
      },
    });

    actions.push({
      type: 'mark_disbursement_rolled_back',
      description: 'Flagged disbursement as rolled back',
      status: 'completed',
      metadata: {
        disbursementId: disbursement.id,
        previousStatus: disbursement.status,
      },
      timestamp: now,
    });

    await tx.auditLog.create({
      data: {
        transactionId: disbursement.id,
        operation: 'DISBURSEMENT_ROLLBACK',
        userId: this.systemActor,
        metadata: {
          loanId: disbursement.loanId,
          reason,
          rolledBackAt: now.toISOString(),
          rolledBackBy: this.systemActor,
        },
      },
    });

    return tx.rollbackRecord.create({
      data: {
        transactionId: updatedDisbursement.id,
        originalOperation: 'disbursement',
        rollbackReason: reason,
        compensatingActions: this.serializeActions(actions),
        rolledBackBy: this.systemActor,
      },
    });
  }

  private async rollbackRepayment(params: {
    tx: Prisma.TransactionClient;
    payment: Payment;
    reason: string;
  }): Promise<PrismaRollbackRecord> {
    const { tx, payment, reason } = params;
    const now = new Date();
    const actions: RollbackAction[] = [];

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'rolled_back',
        rolledBackAt: now,
      },
    });

    actions.push({
      type: 'mark_payment_rolled_back',
      description: 'Flagged repayment record as rolled back',
      status: 'completed',
      metadata: {
        paymentId: payment.id,
        loanId: payment.loanId,
      },
      timestamp: now,
    });

    const compensatingPayment = await tx.payment.create({
      data: {
        loanId: payment.loanId,
        amount: payment.amount.mul(-1),
        paymentDate: now,
        principalPaid: payment.principalPaid.mul(-1),
        interestPaid: payment.interestPaid.mul(-1),
        lateFeePaid: payment.lateFeePaid.mul(-1),
        daysLate: payment.daysLate,
        status: 'ROLLBACK_COMPENSATION',
      },
    });

    actions.push({
      type: 'create_compensating_payment',
      description: 'Inserted reversing payment entry',
      status: 'completed',
      metadata: {
        compensationId: compensatingPayment.id,
        loanId: payment.loanId,
        amount: payment.amount.toString(),
      },
      timestamp: now,
    });

    await tx.auditLog.create({
      data: {
        transactionId: payment.id,
        operation: 'REPAYMENT_ROLLBACK',
        userId: this.systemActor,
        metadata: {
          loanId: payment.loanId,
          reason,
          rolledBackAt: now.toISOString(),
          compensationPaymentId: compensatingPayment.id,
        },
      },
    });

    return tx.rollbackRecord.create({
      data: {
        transactionId: updatedPayment.id,
        originalOperation: 'repayment',
        rollbackReason: reason,
        compensatingActions: this.serializeActions(actions),
        rolledBackBy: this.systemActor,
      },
    });
  }

  private mapRollbackRecord(record: PrismaRollbackRecord): RollbackRecord {
    return {
      transactionId: record.transactionId,
      originalOperation: record.originalOperation as RollbackOperation,
      rollbackReason: record.rollbackReason,
      rollbackTimestamp: record.createdAt,
      compensatingActions: this.deserializeActions(record.compensatingActions),
      rolledBackBy: record.rolledBackBy ?? this.systemActor,
    };
  }

  private mapAuditEntry(log: AuditLog): AuditEntry {
    return {
      id: log.id,
      transactionId: log.transactionId,
      operation: log.operation,
      userId: log.userId,
      metadata: (log.metadata as Record<string, any>) ?? null,
      createdAt: log.createdAt,
    };
  }

  private serializeActions(actions: RollbackAction[]): Prisma.InputJsonValue {
    const serialized = actions.map((action) => ({
      ...action,
      timestamp: action.timestamp.toISOString(),
    }));

    return serialized as Prisma.InputJsonValue;
  }

  private deserializeActions(
    value: Prisma.JsonValue | null,
  ): RollbackAction[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return null;
        }

        const action = entry as Record<string, any>;

        return {
          type: String(action.type ?? 'unknown'),
          description: action.description ?? undefined,
          status: (action.status as RollbackAction['status']) ?? 'completed',
          metadata:
            typeof action.metadata === 'object' ? action.metadata : undefined,
          timestamp: action.timestamp
            ? new Date(action.timestamp)
            : new Date(0),
        } as RollbackAction;
      })
      .filter((action): action is RollbackAction => Boolean(action));
  }
}
