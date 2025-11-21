export type DisbursementStatus = 'pending' | 'completed' | 'failed' | 'rolled_back';

export interface LoanDisbursementSnapshot {
  loanId: string;
  borrowerId: string;
  amount: number;
  currency: string;
  disbursementDate: Date;
  firstPaymentDate: Date;
  tenor: number;
  interestRate: number;
  status: DisbursementStatus;
}

export type CreateDisbursementPayload = Omit<LoanDisbursementSnapshot, 'status'> & {
  status?: DisbursementStatus;
};

export interface RepaymentScheduleEntry {
  loanId: string;
  installmentNumber: number;
  dueDate: Date;
  principalAmount: string;
  interestAmount: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
}
