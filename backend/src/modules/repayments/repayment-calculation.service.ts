import { BadRequestException, Injectable } from '@nestjs/common';

export interface PaymentAllocation {
  interestPaid: number;
  lateFeePaid: number;
  principalPaid: number;
}

@Injectable()
export class RepaymentCalculationService {
  /**
   * Calculate daily interest for a given principal, annual rate, and number of days
   * @param principal - The principal amount
   * @param annualRate - Annual interest rate as a percentage (e.g., 12 for 12%)
   * @param days - Number of days to calculate interest for
   * @param isLeapYear - Whether the year is a leap year (default: false)
   * @returns The calculated interest amount
   */
  calculateDailyInterest(
    principal: number,
    annualRate: number,
    days: number,
    isLeapYear: boolean = false,
  ): number {
    if (principal < 0) {
      throw new BadRequestException('Principal amount cannot be negative');
    }

    if (days < 0) {
      throw new BadRequestException('Days cannot be negative');
    }

    if (days === 0) {
      return 0;
    }

    const daysInYear = isLeapYear ? 366 : 365;
    const dailyRate = annualRate / 100 / daysInYear;
    const interest = principal * dailyRate * days;

    return parseFloat(interest.toFixed(2));
  }

  /**
   * Calculate late fee based on days late
   * Grace period: 0-3 days = $0
   * After grace period: $25 flat fee
   * 30+ days late: $50 increased fee
   * @param daysLate - Number of days the payment is late
   * @returns The calculated late fee
   */
  calculateLateFee(daysLate: number): number {
    if (daysLate < 0) {
      throw new BadRequestException('Days late cannot be negative');
    }

    // Grace period: 0-3 days = no fee
    if (daysLate === 0 || daysLate <= 3) {
      return 0;
    }

    // 30+ days late = increased fee
    if (daysLate >= 30) {
      return 50;
    }

    // After grace period but less than 30 days = flat fee
    return 25;
  }

  /**
   * Allocate payment amount: interest first, then late fee, then principal
   * @param paymentAmount - Total payment amount
   * @param interestDue - Interest amount due
   * @param lateFeeDue - Late fee amount due
   * @param principalRemaining - Remaining principal balance
   * @returns Allocation breakdown
   */
  allocatePayment(
    paymentAmount: number,
    interestDue: number,
    lateFeeDue: number,
    principalRemaining: number,
  ): PaymentAllocation {
    if (paymentAmount < 0) {
      throw new BadRequestException('Payment amount cannot be negative');
    }

    if (interestDue < 0 || lateFeeDue < 0 || principalRemaining < 0) {
      throw new BadRequestException(
        'Interest, late fee, and principal cannot be negative',
      );
    }

    let remaining = paymentAmount;
    const allocation: PaymentAllocation = {
      interestPaid: 0,
      lateFeePaid: 0,
      principalPaid: 0,
    };

    // 1. Pay interest first
    allocation.interestPaid = Math.min(remaining, interestDue);
    remaining -= allocation.interestPaid;

    // 2. Pay late fee second
    if (remaining > 0) {
      allocation.lateFeePaid = Math.min(remaining, lateFeeDue);
      remaining -= allocation.lateFeePaid;
    }

    // 3. Pay principal last
    if (remaining > 0) {
      allocation.principalPaid = Math.min(remaining, principalRemaining);
    }

    // Round to 2 decimal places
    allocation.interestPaid = parseFloat(
      allocation.interestPaid.toFixed(2),
    );
    allocation.lateFeePaid = parseFloat(allocation.lateFeePaid.toFixed(2));
    allocation.principalPaid = parseFloat(
      allocation.principalPaid.toFixed(2),
    );

    return allocation;
  }
}

