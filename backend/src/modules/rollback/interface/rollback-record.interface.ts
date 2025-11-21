export type RollbackOperation = 'disbursement' | 'repayment';

export interface RollbackAction {
  type: string;
  description?: string;
  status: 'pending' | 'completed' | 'failed';
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface RollbackRecord {
  transactionId: string;
  originalOperation: RollbackOperation;
  rollbackReason: string;
  rollbackTimestamp: Date;
  compensatingActions: RollbackAction[];
  rolledBackBy: string;
}

export interface AuditEntry {
  id: string;
  transactionId: string;
  operation: string;
  userId?: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}
