import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditEntry = {
  method: string;
  path: string;
  query: Prisma.InputJsonValue | null;
  status_code: number;
  duration_ms: number;
  request_body: Prisma.InputJsonValue | null;
  response_body: Prisma.InputJsonValue | null;
  error_message: string | null;
  ip: string | null;
  user_agent: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    setImmediate(() => {
      this.prisma.auditLog
        .create({
          data: {
            method: entry.method,
            path: entry.path,
            query: entry.query ?? Prisma.JsonNull,
            status_code: entry.status_code,
            duration_ms: entry.duration_ms,
            request_body: entry.request_body ?? Prisma.JsonNull,
            response_body: entry.response_body ?? Prisma.JsonNull,
            error_message: entry.error_message,
            ip: entry.ip,
            user_agent: entry.user_agent,
          },
        })
        .catch((err) => {
          this.logger.warn(`Audit write failed: ${err.message}`);
        });
    });
  }
}
