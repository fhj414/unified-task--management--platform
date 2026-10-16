import { seedDatabase } from './seed';

describe('seedDatabase', () => {
  it('upserts the fixed departments and mock users on every run', async () => {
    const prisma = {
      department: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      user: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };

    await seedDatabase(prisma);
    await seedDatabase(prisma);

    expect(prisma.department.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.department.upsert).toHaveBeenCalledWith({
      where: { id: '2d2e2c8a-f9bd-4d96-99bf-69cfb4950031' },
      create: expect.objectContaining({ name: 'Engineering' }),
      update: expect.objectContaining({ name: 'Engineering' }),
    });
    expect(prisma.department.upsert).toHaveBeenCalledWith({
      where: { id: '601dc8c4-2479-4af0-a32a-4b8f71b3d5d4' },
      create: expect.objectContaining({ name: 'Operations' }),
      update: expect.objectContaining({ name: 'Operations' }),
    });
    expect(prisma.user.upsert).toHaveBeenCalledTimes(6);
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'ada.lovelace@enterprise-hub.local' },
      }),
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'grace.hopper@enterprise-hub.local' },
      }),
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'linus.torvalds@enterprise-hub.local' },
      }),
    );
  });
});
