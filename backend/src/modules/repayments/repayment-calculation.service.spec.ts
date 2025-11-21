import { RepaymentCalculationService } from './repayment-calculation.service';
import { BadRequestException } from '@nestjs/common';

describe('RepaymentCalculationService', () => {
  let service: RepaymentCalculationService;

  beforeEach(() => {
    service = new RepaymentCalculationService();
  });

  describe('calculateDailyInterest', () => {
    it('should calculate interest correctly for 30 days', () => {
      const principal = 10000;
      const annualRate = 12;
      const days = 30;
      const interest = service.calculateDailyInterest(
        principal,
        annualRate,
        days,
      );

      // Expected: 10000 * (0.12/365) * 30 = 98.63
      expect(interest).toBeCloseTo(98.63, 2);
    });

    it('should calculate interest correctly for 35 days (including late days)', () => {
      const principal = 10000;
      const annualRate = 12;
      const days = 35;
      const interest = service.calculateDailyInterest(
        principal,
        annualRate,
        days,
      );

      // Expected: 10000 * (0.12/365) * 35 = 115.07
      expect(interest).toBeCloseTo(115.07, 2);
    });

    it('should handle leap year correctly', () => {
      const principal = 10000;
      const annualRate = 12;
      const days = 366;
      const interest = service.calculateDailyInterest(
        principal,
        annualRate,
        days,
        true,
      );

      // Expected: 10000 * (0.12/366) * 366 = 1200
      expect(interest).toBeCloseTo(1200, 2);
    });

    it('should return 0 interest for 0 days', () => {
      const interest = service.calculateDailyInterest(10000, 12, 0);
      expect(interest).toBe(0);
    });

    it('should throw error for negative principal', () => {
      expect(() => {
        service.calculateDailyInterest(-10000, 12, 30);
      }).toThrow(BadRequestException);
      expect(() => {
        service.calculateDailyInterest(-10000, 12, 30);
      }).toThrow('Principal amount cannot be negative');
    });

    it('should throw error for negative days', () => {
      expect(() => {
        service.calculateDailyInterest(10000, 12, -5);
      }).toThrow(BadRequestException);
      expect(() => {
        service.calculateDailyInterest(10000, 12, -5);
      }).toThrow('Days cannot be negative');
    });

    it('should calculate correctly for different rates', () => {
      const principal = 5000;
      const annualRate = 6;
      const days = 30;
      const interest = service.calculateDailyInterest(
        principal,
        annualRate,
        days,
      );

      // Expected: 5000 * (0.06/365) * 30 = 24.66
      expect(interest).toBeCloseTo(24.66, 2);
    });

    it('should handle zero principal', () => {
      const interest = service.calculateDailyInterest(0, 12, 30);
      expect(interest).toBe(0);
    });
  });

  describe('calculateLateFee', () => {
    it('should return 0 for payments on time', () => {
      expect(service.calculateLateFee(0)).toBe(0);
    });

    it('should return 0 for 1-3 days late (grace period)', () => {
      expect(service.calculateLateFee(1)).toBe(0);
      expect(service.calculateLateFee(2)).toBe(0);
      expect(service.calculateLateFee(3)).toBe(0);
    });

    it('should apply flat fee after grace period', () => {
      expect(service.calculateLateFee(4)).toBe(25);
      expect(service.calculateLateFee(5)).toBe(25);
      expect(service.calculateLateFee(10)).toBe(25);
      expect(service.calculateLateFee(29)).toBe(25);
    });

    it('should apply increased fee for 30+ days late', () => {
      expect(service.calculateLateFee(30)).toBe(50);
      expect(service.calculateLateFee(31)).toBe(50);
      expect(service.calculateLateFee(60)).toBe(50);
      expect(service.calculateLateFee(100)).toBe(50);
    });

    it('should throw error for negative days late', () => {
      expect(() => {
        service.calculateLateFee(-1);
      }).toThrow(BadRequestException);
      expect(() => {
        service.calculateLateFee(-1);
      }).toThrow('Days late cannot be negative');
    });
  });

  describe('allocatePayment', () => {
    it('should allocate: interest first, then late fee, then principal', () => {
      const allocation = service.allocatePayment(1000, 115.15, 25, 10000);

      expect(allocation.interestPaid).toBeCloseTo(115.15, 2);
      expect(allocation.lateFeePaid).toBe(25);
      expect(allocation.principalPaid).toBeCloseTo(859.85, 2);
    });

    it('should handle partial payment less than interest', () => {
      const allocation = service.allocatePayment(50, 115.15, 25, 10000);

      expect(allocation.interestPaid).toBe(50);
      expect(allocation.lateFeePaid).toBe(0);
      expect(allocation.principalPaid).toBe(0);
    });

    it('should handle payment exactly covering interest and late fee', () => {
      const allocation = service.allocatePayment(140.15, 115.15, 25, 10000);

      expect(allocation.interestPaid).toBeCloseTo(115.15, 2);
      expect(allocation.lateFeePaid).toBe(25);
      expect(allocation.principalPaid).toBe(0);
    });

    it('should handle payment less than interest', () => {
      const allocation = service.allocatePayment(100, 200, 25, 10000);

      expect(allocation.interestPaid).toBe(100);
      expect(allocation.lateFeePaid).toBe(0);
      expect(allocation.principalPaid).toBe(0);
    });

    it('should handle payment covering interest but not late fee', () => {
      const allocation = service.allocatePayment(120, 115.15, 25, 10000);

      expect(allocation.interestPaid).toBeCloseTo(115.15, 2);
      expect(allocation.lateFeePaid).toBeCloseTo(4.85, 2);
      expect(allocation.principalPaid).toBe(0);
    });

    it('should handle payment covering interest and late fee but partial principal', () => {
      const allocation = service.allocatePayment(500, 115.15, 25, 10000);

      expect(allocation.interestPaid).toBeCloseTo(115.15, 2);
      expect(allocation.lateFeePaid).toBe(25);
      expect(allocation.principalPaid).toBeCloseTo(359.85, 2);
    });

    it('should not exceed principal remaining', () => {
      const allocation = service.allocatePayment(10000, 115.15, 25, 500);

      expect(allocation.interestPaid).toBeCloseTo(115.15, 2);
      expect(allocation.lateFeePaid).toBe(25);
      expect(allocation.principalPaid).toBe(500); // Should not exceed remaining principal
    });

    it('should handle zero payment', () => {
      const allocation = service.allocatePayment(0, 115.15, 25, 10000);

      expect(allocation.interestPaid).toBe(0);
      expect(allocation.lateFeePaid).toBe(0);
      expect(allocation.principalPaid).toBe(0);
    });

    it('should handle zero interest due', () => {
      const allocation = service.allocatePayment(1000, 0, 25, 10000);

      expect(allocation.interestPaid).toBe(0);
      expect(allocation.lateFeePaid).toBe(25);
      expect(allocation.principalPaid).toBeCloseTo(975, 2);
    });

    it('should handle zero late fee due', () => {
      const allocation = service.allocatePayment(1000, 115.15, 0, 10000);

      expect(allocation.interestPaid).toBeCloseTo(115.15, 2);
      expect(allocation.lateFeePaid).toBe(0);
      expect(allocation.principalPaid).toBeCloseTo(884.85, 2);
    });

    it('should throw error for negative payment amount', () => {
      expect(() => {
        service.allocatePayment(-100, 115.15, 25, 10000);
      }).toThrow(BadRequestException);
      expect(() => {
        service.allocatePayment(-100, 115.15, 25, 10000);
      }).toThrow('Payment amount cannot be negative');
    });

    it('should throw error for negative interest due', () => {
      expect(() => {
        service.allocatePayment(1000, -115.15, 25, 10000);
      }).toThrow(BadRequestException);
    });

    it('should throw error for negative late fee due', () => {
      expect(() => {
        service.allocatePayment(1000, 115.15, -25, 10000);
      }).toThrow(BadRequestException);
    });

    it('should throw error for negative principal remaining', () => {
      expect(() => {
        service.allocatePayment(1000, 115.15, 25, -10000);
      }).toThrow(BadRequestException);
    });
  });
});

