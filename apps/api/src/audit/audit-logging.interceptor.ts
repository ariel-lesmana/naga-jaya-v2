import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { truncateBody } from './truncate.util';

const SKIP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SKIP_PATH_PREFIXES = ['/logs'];

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (SKIP_METHODS.has(req.method)) {
      return next.handle();
    }

    const rawPath =
      (req as any).originalUrl?.split('?')[0] ?? req.path ?? req.url ?? '';
    if (SKIP_PATH_PREFIXES.some((p) => rawPath.startsWith(p))) {
      return next.handle();
    }

    const startTime = Date.now();
    const contentType = (req.headers['content-type'] ?? '').toString();
    const isMultipart = contentType.includes('multipart/form-data');

    const requestBody = isMultipart
      ? { _multipart: true }
      : truncateBody(req.body);

    const queryVal =
      req.query && Object.keys(req.query).length > 0 ? req.query : null;
    const ip = (req.ip ?? req.socket?.remoteAddress ?? null) as string | null;
    const userAgent = (req.headers['user-agent'] ?? null) as string | null;

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.audit.record({
            method: req.method,
            path: rawPath,
            query: queryVal as any,
            status_code: res.statusCode,
            duration_ms: Date.now() - startTime,
            request_body: requestBody as any,
            response_body: truncateBody(data) as any,
            error_message: null,
            ip,
            user_agent: userAgent,
          });
        },
        error: (err) => {
          const status = typeof err?.status === 'number' ? err.status : 500;
          const responseBody = err?.response ?? null;
          this.audit.record({
            method: req.method,
            path: rawPath,
            query: queryVal as any,
            status_code: status,
            duration_ms: Date.now() - startTime,
            request_body: requestBody as any,
            response_body: truncateBody(responseBody) as any,
            error_message: err?.message ?? String(err),
            ip,
            user_agent: userAgent,
          });
        },
      }),
    );
  }
}
