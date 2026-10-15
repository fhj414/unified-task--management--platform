import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  LoggerService,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';

interface RequestLogEntry {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

interface HttpRequestMetadata {
  method: string;
  path?: string;
  originalUrl?: string;
  url?: string;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: LoggerService = new Logger(
      RequestLoggingInterceptor.name,
    ),
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<HttpRequestMetadata>();
    const response = httpContext.getResponse<{ statusCode: number }>();
    const startedAt = Date.now();
    const path = this.getRequestPath(request);
    const entry = (statusCode: number): RequestLogEntry => ({
      method: request.method,
      path,
      statusCode,
      durationMs: Date.now() - startedAt,
    });

    return next.handle().pipe(
      tap({
        complete: () => this.logger.log(entry(response.statusCode)),
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        this.logger.error(entry(statusCode));
        return throwError(() => error);
      }),
    );
  }

  private getRequestPath(request: HttpRequestMetadata): string {
    const rawPath = request.path ?? request.originalUrl ?? request.url ?? '/';
    return rawPath.split(/[?#]/, 1)[0] || '/';
  }
}
