import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminTokenGuard } from './admin-token.guard';

@Controller('logs')
@UseGuards(AdminTokenGuard)
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('page') pageQ?: string,
    @Query('limit') limitQ?: string,
    @Query('method') method?: string,
    @Query('path') path?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status_min') statusMinQ?: string,
  ) {
    const page = Math.max(1, pageQ ? parseInt(pageQ, 10) : 1);
    const limitRaw = limitQ ? parseInt(limitQ, 10) : 50;
    const limit = Math.min(200, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (method) where.method = method.toUpperCase();
    if (path) where.path = { contains: path, mode: 'insensitive' };
    if (statusMinQ) {
      const s = parseInt(statusMinQ, 10);
      if (!Number.isNaN(s)) where.status_code = { gte: s };
    }
    if (from || to) {
      where.created_at = {};
      if (from) (where.created_at as any).gte = new Date(from);
      if (to) (where.created_at as any).lte = new Date(to);
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          method: true,
          path: true,
          status_code: true,
          duration_ms: true,
          error_message: true,
          ip: true,
          created_at: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const row = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Log #${id} not found`);
    return row;
  }
}
