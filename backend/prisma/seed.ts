import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // --- Loan 1: User A ---
  const loan1 = await prisma.loan.create({
    data: {
      borrowerId: "user-A",
      amount: 15000.00,
      interestRate: 6.5,
      tenor: 12,
      status: "APPROVED",
      disbursement: {
        create: {
          amount: 15000.00,
          disbursementDate: new Date("2025-11-01"),
          status: "SUCCESS"
        }
      },
      schedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date("2025-12-01"),
            principalAmount: 1200.00,
            interestAmount: 80.00,
            status: "PENDING"
          },
          {
            installmentNumber: 2,
            dueDate: new Date("2026-01-01"),
            principalAmount: 1200.00,
            interestAmount: 75.00,
            status: "PENDING"
          }
        ]
      },
      payments: {
        create: [
          {
            amount: 1280.00,
            paymentDate: new Date("2025-12-02"),
            principalPaid: 1200.00,
            interestPaid: 80.00,
            lateFeePaid: 0.00,
            daysLate: 1,
            status: "COMPLETED"
          }
        ]
      }
    }
  });

  // --- Loan 2: User B ---
  const loan2 = await prisma.loan.create({
    data: {
      borrowerId: "user-B",
      amount: 8000.00,
      interestRate: 5.0,
      tenor: 6,
      status: "APPROVED",
      disbursement: {
        create: {
          amount: 8000.00,
          disbursementDate: new Date("2025-11-05"),
          status: "SUCCESS"
        }
      },
      schedules: {
        create: [
          {
            installmentNumber: 1,
            dueDate: new Date("2025-12-05"),
            principalAmount: 1300.00,
            interestAmount: 50.00,
            status: "PENDING"
          },
          {
            installmentNumber: 2,
            dueDate: new Date("2026-01-05"),
            principalAmount: 1300.00,
            interestAmount: 45.00,
            status: "PENDING"
          }
        ]
      },
      payments: {
        create: [
          {
            amount: 1350.00,
            paymentDate: new Date("2025-12-06"),
            principalPaid: 1300.00,
            interestPaid: 50.00,
            lateFeePaid: 0.00,
            daysLate: 1,
            status: "COMPLETED"
          }
        ]
      }
    }
  });

  // --- Rollback Records ---
  await prisma.rollbackRecord.create({
    data: {
      transactionId: loan1.id,
      originalOperation: "CREATE_LOAN",
      rollbackReason: "Incorrect borrower details",
      compensatingActions: { action: "Reverse disbursement and cancel schedules" },
      rolledBackBy: "admin-001"
    }
  });

  await prisma.rollbackRecord.create({
    data: {
      transactionId: loan2.id,
      originalOperation: "DISBURSEMENT",
      rollbackReason: "Bank transfer failed",
      compensatingActions: { action: "Mark disbursement as FAILED and notify borrower" },
      rolledBackBy: "admin-002"
    }
  });

  console.log("✅ Seeded two loans, disbursements, schedules, payments, and rollbacks!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });