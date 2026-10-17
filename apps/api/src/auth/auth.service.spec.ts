import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/database/prisma.service';
import { AuthService } from './auth.service';

const ada = {
  id: 'user-id',
  email: 'ada.lovelace@enterprise-hub.local',
  name: 'Ada Lovelace',
  departmentId: 'engineering-id',
  department: { id: 'engineering-id', name: 'Engineering' },
  createdAt: new Date('2026-10-16T00:00:00.000Z'),
  updatedAt: new Date('2026-10-16T00:00:00.000Z'),
};

const nonDemoUser = {
  id: 'user-without-department-id',
  email: 'employee@enterprise-hub.local',
  name: 'Real Employee',
  departmentId: null,
  department: null,
  createdAt: new Date('2026-10-16T00:00:00.000Z'),
  updatedAt: new Date('2026-10-16T00:00:00.000Z'),
};

describe('AuthService', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const jwtService = {
    signAsync: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  it('lists only allowlisted mock users without database timestamps', async () => {
    prisma.user.findMany.mockResolvedValue([ada, nonDemoUser]);

    await expect(service.listMockUsers()).resolves.toEqual([
      {
        id: 'user-id',
        email: 'ada.lovelace@enterprise-hub.local',
        name: 'Ada Lovelace',
        department: { id: 'engineering-id', name: 'Engineering' },
      },
    ]);
  });

  it('creates a login response from a matching mock user', async () => {
    prisma.user.findUnique.mockResolvedValue(ada);
    jwtService.signAsync.mockResolvedValue('signed-access-token');

    await expect(
      service.login('ada.lovelace@enterprise-hub.local'),
    ).resolves.toEqual({
      accessToken: 'signed-access-token',
      user: {
        id: 'user-id',
        email: 'ada.lovelace@enterprise-hub.local',
        name: 'Ada Lovelace',
        department: { id: 'engineering-id', name: 'Engineering' },
      },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'ada.lovelace@enterprise-hub.local',
    });
  });

  it('rejects login for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login('missing@enterprise-hub.local'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-demo database user before lookup or token signing', async () => {
    prisma.user.findUnique.mockResolvedValue(nonDemoUser);

    await expect(
      service.login('employee@enterprise-hub.local'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('returns the current user without database timestamps', async () => {
    prisma.user.findUnique.mockResolvedValue(nonDemoUser);

    await expect(service.getCurrentUser('user-without-department-id')).resolves
      .toEqual({
        id: 'user-without-department-id',
        email: 'employee@enterprise-hub.local',
        name: 'Real Employee',
        department: null,
      });
  });

  it('rejects a missing current user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getCurrentUser('missing-user-id')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
