import { Prisma, PrismaClient } from '@prisma/client';

type SeedPrismaClient = {
  department: {
    upsert(args: Prisma.DepartmentUpsertArgs): Promise<unknown>;
  };
  user: {
    upsert(args: Prisma.UserUpsertArgs): Promise<unknown>;
  };
};

const departments = [
  { id: '2d2e2c8a-f9bd-4d96-99bf-69cfb4950031', name: 'Engineering' },
  { id: '601dc8c4-2479-4af0-a32a-4b8f71b3d5d4', name: 'Operations' },
] as const;

const users = [
  {
    email: 'ada.lovelace@enterprise-hub.local',
    name: 'Ada Lovelace',
    departmentId: departments[0].id,
  },
  {
    email: 'grace.hopper@enterprise-hub.local',
    name: 'Grace Hopper',
    departmentId: departments[1].id,
  },
  {
    email: 'linus.torvalds@enterprise-hub.local',
    name: 'Linus Torvalds',
    departmentId: departments[0].id,
  },
] as const;

export async function seedDatabase(prisma: SeedPrismaClient): Promise<void> {
  for (const department of departments) {
    await prisma.department.upsert({
      where: { id: department.id },
      create: department,
      update: { name: department.name },
    });
  }

  for (const user of users) {
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
