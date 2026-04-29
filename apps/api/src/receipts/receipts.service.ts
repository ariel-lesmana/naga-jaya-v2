import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product, ReceiptStatus, ReceiptUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { ReceiptItemDto } from './dto/receipt-item.dto';

const PRICE_FIELD: Record<ReceiptUnit, keyof Product> = {
  pcs: 'harga_jual',
  lusin: 'harga_jual_per_lusin',
  pak: 'harga_jual_per_pak',
  kotak: 'harga_jual_per_kotak',
  karton: 'harga_jual_per_karton',
};

const ITEM_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      brand_id: true,
      harga_jual: true,
      harga_jual_per_lusin: true,
      harga_jual_per_pak: true,
      harga_jual_per_kotak: true,
      harga_jual_per_karton: true,
      deleted_at: true,
    },
  },
} satisfies Prisma.ReceiptItemInclude;

const RECEIPT_INCLUDE = {
  items: {
    orderBy: { position: 'asc' as const },
    include: ITEM_INCLUDE,
  },
} satisfies Prisma.ReceiptInclude;

@Injectable()
export class ReceiptsService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    status?: ReceiptStatus;
    search?: string;
    page?: number;
    limit?: number;
    deleted?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ReceiptWhereInput = params.deleted
      ? { deleted_at: { not: null } }
      : { deleted_at: null };
    if (params.status) where.status = params.status;
    if (params.search) {
      where.customer_name = { contains: params.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        include: { items: { select: { id: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        customer_name: r.customer_name,
        status: r.status,
        finalized_at: r.finalized_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        item_count: r.items.length,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async latestDraft() {
    const draft = await this.prisma.receipt.findFirst({
      where: { status: ReceiptStatus.DRAFT, deleted_at: null },
      orderBy: { created_at: 'desc' },
      include: RECEIPT_INCLUDE,
    });
    return draft;
  }

  async findOne(id: number) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, deleted_at: null },
      include: RECEIPT_INCLUDE,
    });
    if (!receipt) throw new NotFoundException(`Receipt #${id} not found`);
    return receipt;
  }

  async create(dto: CreateReceiptDto) {
    return this.prisma.receipt.create({
      data: { customer_name: dto.customer_name ?? null },
      include: RECEIPT_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateReceiptDto) {
    const existing = await this.prisma.receipt.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException(`Receipt #${id} not found`);
    if (existing.status === ReceiptStatus.FINALIZED) {
      throw new BadRequestException('Cannot edit a finalized receipt');
    }
    return this.prisma.receipt.update({
      where: { id },
      data: { customer_name: dto.customer_name ?? null },
      include: RECEIPT_INCLUDE,
    });
  }

  async replaceItems(receiptId: number, items: ReceiptItemDto[]) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, deleted_at: null },
    });
    if (!receipt) throw new NotFoundException(`Receipt #${receiptId} not found`);
    if (receipt.status === ReceiptStatus.FINALIZED) {
      throw new BadRequestException('Cannot edit items of a finalized receipt');
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.receiptItem.findMany({
        where: { receipt_id: receiptId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const keepIds = new Set(
        items
          .filter((i) => i.id != null && existingIds.has(i.id))
          .map((i) => i.id as number),
      );
      const toDelete = existing
        .filter((e) => !keepIds.has(e.id))
        .map((e) => e.id);
      if (toDelete.length) {
        await tx.receiptItem.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const trimmedNotes =
          typeof it.notes === 'string' ? it.notes.trim() : null;
        const data = {
          product_id: it.product_id ?? null,
          quantity: it.quantity ?? null,
          unit_type: it.unit_type ?? null,
          discount_per_unit: it.discount_per_unit ?? 0,
          line_total_override: it.line_total_override ?? null,
          notes: trimmedNotes ? trimmedNotes : null,
          position: it.position ?? idx,
        };
        if (it.id != null && existingIds.has(it.id)) {
          await tx.receiptItem.update({
            where: { id: it.id },
            data,
          });
        } else {
          await tx.receiptItem.create({
            data: { ...data, receipt_id: receiptId },
          });
        }
      }

      await tx.receipt.update({
        where: { id: receiptId },
        data: { updated_at: new Date() },
      });
    });

    return this.findOne(receiptId);
  }

  async deleteItem(receiptId: number, itemId: number) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, deleted_at: null },
    });
    if (!receipt) throw new NotFoundException(`Receipt #${receiptId} not found`);
    if (receipt.status === ReceiptStatus.FINALIZED) {
      throw new BadRequestException('Cannot edit items of a finalized receipt');
    }
    await this.prisma.receiptItem.deleteMany({
      where: { id: itemId, receipt_id: receiptId },
    });
    return { success: true };
  }

  async finalize(receiptId: number) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, deleted_at: null },
      include: RECEIPT_INCLUDE,
    });
    if (!receipt) throw new NotFoundException(`Receipt #${receiptId} not found`);
    if (receipt.status === ReceiptStatus.FINALIZED) {
      throw new BadRequestException('Receipt already finalized');
    }
    if (receipt.items.length === 0) {
      throw new BadRequestException('Cannot finalize an empty receipt');
    }

    const errors: string[] = [];
    const snapshots: { id: number; price: number; name: string }[] = [];

    for (const item of receipt.items) {
      if (!item.product_id || !item.product) {
        errors.push(`Item #${item.id}: no product selected`);
        continue;
      }
      if (item.product.deleted_at) {
        errors.push(`Item #${item.id}: product "${item.product.name}" deleted`);
        continue;
      }
      if (!item.unit_type) {
        errors.push(`Item #${item.id}: no unit_type`);
        continue;
      }
      if (item.quantity == null || item.quantity <= 0) {
        errors.push(`Item #${item.id}: quantity must be > 0`);
        continue;
      }
      const priceField = PRICE_FIELD[item.unit_type];
      const price = item.product[priceField] as number | null;
      if (price == null) {
        errors.push(
          `Item #${item.id}: product "${item.product.name}" has no ${priceField}`,
        );
        continue;
      }
      snapshots.push({ id: item.id, price, name: item.product.name });
    }

    if (errors.length) {
      throw new BadRequestException({ message: 'Finalize blocked', errors });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const s of snapshots) {
        await tx.receiptItem.update({
          where: { id: s.id },
          data: { price_snapshot: s.price, product_name_snapshot: s.name },
        });
      }
      await tx.receipt.update({
        where: { id: receiptId },
        data: { status: ReceiptStatus.FINALIZED, finalized_at: new Date() },
      });
    });

    return this.findOne(receiptId);
  }

  async duplicate(receiptId: number) {
    const source = await this.prisma.receipt.findFirst({
      where: { id: receiptId, deleted_at: null },
      include: RECEIPT_INCLUDE,
    });
    if (!source) throw new NotFoundException(`Receipt #${receiptId} not found`);
    if (source.status !== ReceiptStatus.FINALIZED) {
      throw new BadRequestException('Only finalized receipts can be duplicated');
    }

    const created = await this.prisma.receipt.create({
      data: {
        customer_name: source.customer_name,
        status: ReceiptStatus.DRAFT,
        items: {
          create: source.items.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
            unit_type: it.unit_type,
            discount_per_unit: it.discount_per_unit,
            line_total_override: null,
            notes: it.notes,
            position: it.position,
          })),
        },
      },
      include: RECEIPT_INCLUDE,
    });
    return created;
  }

  async remove(id: number) {
    const existing = await this.prisma.receipt.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException(`Receipt #${id} not found`);
    await this.prisma.receipt.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { success: true };
  }

  async restore(id: number) {
    const existing = await this.prisma.receipt.findUnique({ where: { id } });
    if (!existing || existing.deleted_at == null) {
      throw new NotFoundException(`Deleted receipt #${id} not found`);
    }
    await this.prisma.receipt.update({
      where: { id },
      data: { deleted_at: null },
    });
    return this.findOne(id);
  }

  async permanentRemove(id: number) {
    const existing = await this.prisma.receipt.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Receipt #${id} not found`);
    await this.prisma.receipt.delete({ where: { id } });
    return { success: true };
  }
}
