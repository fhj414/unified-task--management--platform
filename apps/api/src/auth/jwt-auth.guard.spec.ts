import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextFor(headers: Record<string, string | undefined>): {
  context: ExecutionContext;
  request: { headers: Record<string, string | undefined>; authUser?: unknown };
} {
  const request: { headers: Record<string, string | undefined>; authUser?: unknown } = {
    headers,
  };

  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
}

describe('JwtAuthGuard', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const guard = new JwtAuthGuard(jwtService as unknown as JwtService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects a request without exactly one Bearer token', async () => {
    const { context } = contextFor({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('replaces JWT verification details with a public unauthorized error', async () => {
    const { context } = contextFor({ authorization: 'Bearer invalid-token' });
    jwtService.verifyAsync.mockRejectedValue(new Error('private signing key detail'));

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      message: 'Invalid or expired access token',
    });
  });

  it('attaches the verified identity to the request', async () => {
    const { context, request } = contextFor({ authorization: 'Bearer valid-token' });
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      email: 'ada.lovelace@enterprise-hub.local',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.authUser).toEqual({
      sub: 'user-id',
      email: 'ada.lovelace@enterprise-hub.local',
    });
  });
});
