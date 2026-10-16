import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtAuthUser {
  sub: string;
  email: string;
}

interface AuthenticatedRequest {
  headers: { authorization?: string | string[] };
  authUser?: JwtAuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token);
      if (!isJwtAuthUser(payload)) {
        throw new Error('Invalid JWT payload');
      }
      request.authUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private getBearerToken(authorization: string | string[] | undefined): string | null {
    if (typeof authorization !== 'string') {
      return null;
    }

    const [scheme, token, ...extra] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token || extra.length !== 0) {
      return null;
    }

    return token;
  }
}

function isJwtAuthUser(payload: unknown): payload is JwtAuthUser {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const { sub, email } = payload as Record<string, unknown>;
  return typeof sub === 'string' && typeof email === 'string';
}
