import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  LoggerService,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

class CapturingLogger implements LoggerService {
  readonly logs: unknown[] = [];
  readonly errors: unknown[] = [];

  log(message: unknown): void {
    this.logs.push(message);
  }

  error(message: unknown): void {
    this.errors.push(message);
  }

  warn(): void {}
}

function createContext(statusCode = 201): ExecutionContext {
  const request = {
    method: 'POST',
    url: '/example?visible=true',
    headers: { authorization: 'Bearer private-token' },
    body: { password: 'private-password' },
  };
  const response = { statusCode };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
}

describe('RequestLoggingInterceptor', () => {
  it('logs request metadata on completion and preserves emitted values', async () => {
    const logger = new CapturingLogger();
    const interceptor = new RequestLoggingInterceptor(logger);
    const next = { handle: () => of('unchanged result') } as CallHandler;

    const result = await lastValueFrom(interceptor.intercept(createContext(), next));

    expect(result).toBe('unchanged result');
    expect(logger.logs).toEqual([
      {
        method: 'POST',
        url: '/example?visible=true',
        statusCode: 201,
        durationMs: expect.any(Number),
      },
    ]);
    expect((logger.logs[0] as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(
      0,
    );
    expect(JSON.stringify(logger.logs)).not.toMatch(
      /private-token|private-password|authorization|headers|body/,
    );
  });

  it('logs an exception status without details and rethrows the same error', async () => {
    const logger = new CapturingLogger();
    const interceptor = new RequestLoggingInterceptor(logger);
    const error = new BadRequestException('private validation details');
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(createContext(200), next)),
    ).rejects.toBe(error);
    expect(logger.errors).toEqual([
      {
        method: 'POST',
        url: '/example?visible=true',
        statusCode: 400,
        durationMs: expect.any(Number),
      },
    ]);
    expect(JSON.stringify(logger.errors)).not.toContain('private validation details');
  });

  it('logs an unknown error as 500 without exposing its message or stack', async () => {
    const logger = new CapturingLogger();
    const interceptor = new RequestLoggingInterceptor(logger);
    const error = new Error('private infrastructure details');
    const next = {
      handle: () => throwError(() => error),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(createContext(200), next)),
    ).rejects.toBe(error);
    expect(logger.errors).toEqual([
      {
        method: 'POST',
        url: '/example?visible=true',
        statusCode: 500,
        durationMs: expect.any(Number),
      },
    ]);
    expect(JSON.stringify(logger.errors)).not.toMatch(
      /private infrastructure details|Error:|at /,
    );
  });
});
