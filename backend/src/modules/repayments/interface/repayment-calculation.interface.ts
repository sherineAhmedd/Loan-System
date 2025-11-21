export interface InstallmentDue {
  installmentNumber: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  status?: string;
}

export interface LateFeeCalculation {
  installmentNumber: number;
  dueDate: Date;
  daysLate: number;
  calculatedLateFee: number;
}

export interface RepaymentSummary {
  overdueInstallments: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  totalPaidLateFees: number;
  totalCalculatedLateFees: number;
}

export interface RepaymentCalculationResult {
  loanId: string;
  borrowerId: string;
  loanStatus: string;
  asOfDate: Date;
  summary: RepaymentSummary;
  installmentsDue: InstallmentDue[];
  lateFeeCalculations: LateFeeCalculation[];
  nextInstallment: InstallmentDue | null;
}

export interface RepaymentRequestPayload {
  loanId: string;
  amount: number;
  paymentDate?: Date;
  principalPaid?: number;
  interestPaid?: number;
  lateFeePaid?: number;
  daysLate?: number;
  status?: string;
}
