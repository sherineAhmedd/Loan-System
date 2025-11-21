import { Test, TestingModule } from '@nestjs/testing';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { AuditService } from 'src/audit/audit.service';

describe('LoanController', () => {
  let controller: LoanController;
  let service: LoanService;
  let auditService: AuditService;

  const mockLoanService = {
    getLoanById: jest.fn(),
    listLoans: jest.fn(),
  };

  const mockAuditService = {
    getAuditLogsByLoanId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoanController],
      providers: [
        {
          provide: LoanService,
          useValue: mockLoanService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<LoanController>(LoanController);
    service = module.get<LoanService>(LoanService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  

  it('should delegate loan retrieval to service', async () => {
    const loan = { id: 'loan-1' };
    mockLoanService.getLoanById.mockResolvedValue(loan);

    const result = await controller.getLoan('loan-1');

    expect(result).toEqual(loan);
    expect(mockLoanService.getLoanById).toHaveBeenCalledWith('loan-1');
  });

  it('should return audit trail for loan', async () => {
    const auditLogs = [{ id: 'log-1' }];
    mockAuditService.getAuditLogsByLoanId.mockResolvedValue(auditLogs);

    const result = await controller.getAuditTrail('loan-1');

    expect(result).toEqual(auditLogs);
    expect(mockAuditService.getAuditLogsByLoanId).toHaveBeenCalledWith(
      'loan-1',
    );
  });
});
