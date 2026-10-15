import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

type PublicMessage = string | string[];

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    httpAdapter.reply(
      context.getResponse(),
      {
        statusCode,
        message: this.getPublicMessage(exception),
        path: httpAdapter.getRequestUrl(context.getRequest()),
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }

  private getPublicMessage(exception: unknown): PublicMessage {
    if (!(exception instanceof HttpException)) {
      return 'Internal server error';
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null && 'message' in response) {
      const { message } = response as { message?: unknown };
      if (typeof message === 'string') {
        return message;
      }
      if (
        Array.isArray(message) &&
        message.every((item): item is string => typeof item === 'string')
      ) {
        return message;
      }
    }

    return 'Internal server error';
  }
}
