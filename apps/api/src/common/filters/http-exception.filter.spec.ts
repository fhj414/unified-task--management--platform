import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { HttpExceptionFilter } from './http-exception.filter';

interface CapturedResponse {
  statusCode?: number;
  body?: unknown;
}

function createFilterHarness(path = '/example') {
  const response: CapturedResponse = {};
  const request = { url: path };
  const httpAdapter = {
    getRequestUrl: (incomingRequest: typeof request) => incomingRequest.url,
    reply: (
      outgoingResponse: CapturedResponse,
      body: unknown,
      statusCode: number,
    ) => {
      outgoingResponse.statusCode = statusCode;
      outgoingResponse.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;
  const filter = new HttpExceptionFilter({ httpAdapter } as HttpAdapterHost);

  return { filter, host, response };
}

describe('HttpExceptionFilter', () => {
  it('writes a normalized public response for a bad request', () => {
    const { filter, host, response } = createFilterHarness();

    filter.catch(new BadRequestException('invalid input'), host);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      message: 'invalid input',
      path: '/example',
      timestamp: expect.any(String),
    });
    expect(
      Number.isNaN(Date.parse((response.body as { timestamp: string }).timestamp)),
    ).toBe(false);
  });

  it('preserves a string-array Nest exception message', () => {
    const { filter, host, response } = createFilterHarness();
    const exception = new HttpException(
      { message: ['name is required', 'email must be valid'] },
      422,
    );

    filter.catch(exception, host);

    expect(response.body).toEqual({
      statusCode: 422,
      message: ['name is required', 'email must be valid'],
      path: '/example',
      timestamp: expect.any(String),
    });
  });

  it('hides details from unknown errors behind a 500 response', () => {
    const { filter, host, response } = createFilterHarness();

    filter.catch(new Error('database password leaked'), host);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      path: '/example',
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('database password');
  });
});
