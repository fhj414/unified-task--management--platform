import { Prisma, PrismaClient } from '@prisma/client';
import {
  MOCK_DEPARTMENTS,
  MOCK_IDENTITIES,
} from '../src/auth/mock-identities';

type SeedPrismaClient = {
  department: {
    upsert(args: Prisma.DepartmentUpsertArgs): Promise<unknown>;
  };
  user: {
    upsert(args: Prisma.UserUpsertArgs): Promise<unknown>;
  };
};

export async function seedDatabase(prisma: SeedPrismaClient): Promise<void> {
  for (const department of MOCK_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: department.id },
      create: department,
      update: { name: department.name },
    });
  }

  for (const user of MOCK_IDENTITIES) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: user,
      update: { name: user.name, departmentId: user.departmentId },
    });
  }
}

export async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
