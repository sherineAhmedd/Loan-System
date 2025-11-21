import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Disbursements (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    const configService = moduleFixture.get<ConfigService>(ConfigService);

    // Generate a test JWT token
    const secret = configService.get<string>('JWT_SECRET') || 'loan-system-secret-key-change-in-production';
    authToken = jwtService.sign(
      { sub: 'test-service', service: 'test-service' },
      { secret },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.payment.deleteMany();
    await prisma.repaymentSchedule.deleteMany();
    await prisma.disbursement.deleteMany();
    await prisma.loan.deleteMany();
  });

  describe('POST /api/disbursements', () => {
    it('should create a new disbursement', async () => {
      // First create a loan
      const loan = await prisma.loan.create({
        data: {
          borrowerId: 'borrower-456',
          amount: 10000,
          interestRate: 12,
          tenor: 12,
          status: 'APPROVED',
        },
      });

      return request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          loanId: loan.id,
          borrowerId: 'borrower-456',
          amount: 10000,
          currency: 'USD',
          tenor: 12,
          interestRate: 12,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('completed');
          expect(res.body.loanId).toBe(loan.id);
        });
    });

    it('should reject duplicate disbursement', async () => {
      // Create a loan
      const loan = await prisma.loan.create({
        data: {
          borrowerId: 'borrower-dup',
          amount: 10000,
          interestRate: 12,
          tenor: 12,
          status: 'APPROVED',
        },
      });

      const data = {
        loanId: loan.id,
        borrowerId: 'borrower-dup',
        amount: 10000,
        currency: 'USD',
        tenor: 12,
        interestRate: 12,
      };

      // First disbursement should succeed
      await request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send(data)
        .expect(201);

      // Second disbursement should fail with 409 or 400
      return request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send(data)
        .expect((res) => {
          expect([400, 409]).toContain(res.status);
        });
    });

    it('should handle security vulnerabilities appropriately', () => {
      return request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          loanId: "'; DROP TABLE loans; --",
          amount: 10000,
        })
        .expect((res) => {
          // Should not return 500 or crash
          expect([400, 401, 403]).toContain(res.status);
        });
    });

    it('should reject request without authorization token', () => {
      return request(app.getHttpServer())
        .post('/api/disbursements')
        .send({
          loanId: 'loan-123',
          borrowerId: 'borrower-456',
          amount: 10000,
          currency: 'USD',
          tenor: 12,
          interestRate: 12,
        })
        .expect(401);
    });

    it('should reject request with invalid loan ID format', async () => {
      return request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          loanId: 'invalid-uuid',
          borrowerId: 'borrower-456',
          amount: 10000,
          currency: 'USD',
          tenor: 12,
          interestRate: 12,
        })
        .expect(400);
    });

    it('should reject request for non-existent loan', () => {
      const fakeLoanId = '00000000-0000-0000-0000-000000000000';
      return request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          loanId: fakeLoanId,
          borrowerId: 'borrower-456',
          amount: 10000,
          currency: 'USD',
          tenor: 12,
          interestRate: 12,
        })
        .expect(400);
    });

    it('should reject request for loan that is not approved', async () => {
      const loan = await prisma.loan.create({
        data: {
          borrowerId: 'borrower-pending',
          amount: 10000,
          interestRate: 12,
          tenor: 12,
          status: 'PENDING',
        },
      });

      return request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          loanId: loan.id,
          borrowerId: 'borrower-pending',
          amount: 10000,
          currency: 'USD',
          tenor: 12,
          interestRate: 12,
        })
        .expect(400);
    });

    it('should create repayment schedule when disbursement is created', async () => {
      const loan = await prisma.loan.create({
        data: {
          borrowerId: 'borrower-schedule',
          amount: 10000,
          interestRate: 12,
          tenor: 12,
          status: 'APPROVED',
        },
      });

      await request(app.getHttpServer())
        .post('/api/disbursements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          loanId: loan.id,
          borrowerId: 'borrower-schedule',
          amount: 10000,
          currency: 'USD',
          tenor: 12,
          interestRate: 12,
        })
        .expect(201);

      // Verify repayment schedule was created
      const schedules = await prisma.repaymentSchedule.findMany({
        where: { loanId: loan.id },
      });

      expect(schedules).toHaveLength(12);
      expect(schedules[0].installmentNumber).toBe(1);
      expect(schedules[11].installmentNumber).toBe(12);
    });
  });
});

