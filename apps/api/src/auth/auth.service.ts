import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser, MockLoginResponse } from '@enterprise-hub/shared';
import { PrismaService } from '../common/database/prisma.service';
import {
  isMockIdentityEmail,
  MOCK_IDENTITY_EMAILS,
} from './mock-identities';

interface UserWithDepartment {
  id: string;
  email: string;
  name: string;
  department: { id: string; name: string } | null;
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async listMockUsers(): Promise<AuthenticatedUser[]> {
    const users = await this.prisma.user.findMany({
      where: { email: { in: MOCK_IDENTITY_EMAILS } },
      select: userSelect,
    });

    return users
      .filter((user) => isMockIdentityEmail(user.email))
      .map((user) => this.toAuthenticatedUser(user));
  }

  async login(email: string): Promise<MockLoginResponse> {
    if (!isMockIdentityEmail(email)) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
      }),
      user: this.toAuthenticatedUser(user),
    };
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toAuthenticatedUser(user);
  }

  private toAuthenticatedUser(user: UserWithDepartment): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      department: user.department,
    };
  }
}
