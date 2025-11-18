import { Test, TestingModule } from '@nestjs/testing';
import { LoanService } from './loan.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('LoanService', () => {
  let service: LoanService;
  let prisma: PrismaService;

  const mockPrismaService = {
    loan: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LoanService>(LoanService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
