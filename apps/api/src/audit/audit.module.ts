import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditLoggingInterceptor } from './audit-logging.interceptor';
import { AuditController } from './audit.controller';
import { AdminTokenGuard } from './admin-token.guard';

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AdminTokenGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggingInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
