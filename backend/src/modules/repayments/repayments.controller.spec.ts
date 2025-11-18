import { Test, TestingModule } from '@nestjs/testing';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';

describe('RepaymentsController', () => {
  let controller: RepaymentsController;
  let service: RepaymentsService;

  const mockService = {
    recordRepayment: jest.fn(),
    getPaymentHistory: jest.fn(),
    getRepaymentSchedule: jest.fn(),
    calculateDueNow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepaymentsController],
      providers: [
        {
          provide: RepaymentsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RepaymentsController>(RepaymentsController);
    service = module.get<RepaymentsService>(RepaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should record a repayment', async () => {
    const dto = {
      loanId: 'loan-1',
      amount: 100,
      principalPaid: 80,
      interestPaid: 20,
    } as CreateRepaymentDto;

    const created = { id: 'payment-1' };
    mockService.recordRepayment.mockResolvedValue(created);

    const result = await controller.recordRepayment(dto);

    expect(result).toEqual(created);
    expect(service.recordRepayment).toHaveBeenCalledWith(dto);
  });

  it('should get payment history', async () => {
    const payload = [{ id: 'payment-1' }];
    mockService.getPaymentHistory.mockResolvedValue(payload);

    const result = await controller.getPaymentHistory('loan-1');

    expect(result).toEqual(payload);
    expect(service.getPaymentHistory).toHaveBeenCalledWith('loan-1');
  });

  it('should get repayment schedule', async () => {
    const schedule = [{ installmentNumber: 1 }];
    mockService.getRepaymentSchedule.mockResolvedValue(schedule);

    const result = await controller.getSchedule('loan-1');

    expect(result).toEqual(schedule);
    expect(service.getRepaymentSchedule).toHaveBeenCalledWith('loan-1');
  });

  it("should calculate what's due", async () => {
    const payload = { summary: { totalDue: 100 } };
    mockService.calculateDueNow.mockResolvedValue(payload);

    const result = await controller.calculateDue('loan-1');

    expect(result).toEqual(payload);
    expect(service.calculateDueNow).toHaveBeenCalledWith('loan-1');
  });
});

