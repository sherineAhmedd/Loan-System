import { Test, TestingModule } from '@nestjs/testing';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';

describe('LoanController', () => {
  let controller: LoanController;
  let service: LoanService;

  const mockLoanService = {
    getLoanById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoanController],
      providers: [
        {
          provide: LoanService,
          useValue: mockLoanService,
        },
      ],
    }).compile();

    controller = module.get<LoanController>(LoanController);
    service = module.get<LoanService>(LoanService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
