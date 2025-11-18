export type Loan = {
  id: string;
  borrowerId: string;
  amount: number;
  interestRate: number;
  tenor: number;
  status: string;
  createdAt?: string;
};

export type Disbursement = {
  id: string;
  loanId: string;
  amount: number;
  disbursementDate: string;
  status: string;
};

export type Payment = {
  id: string;
  amount: number;
  paymentDate: string;
  principalPaid: number;
  interestPaid: number;
  lateFeePaid?: number;
  daysLate?: number;
  status: string;
};

export type AuditLog = {
  id: string;
  transactionId: string;
  operation: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

