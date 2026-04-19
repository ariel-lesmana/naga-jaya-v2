import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriceHistoryService } from '../price-history/price-history.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private priceHistoryService: PriceHistoryService,
  ) {}

  private computeDiscNet(gross: number | null, disc: number | null): number | null {
    if (gross == null || disc == null) return null;
    return Math.round(gross * (1 - disc / 100));
  }

  private computeFields(product: any) {
    const disc_pct_num = product.disc_pct != null ? Number(product.disc_pct) : null;
    const disc_net_computed = this.computeDiscNet(product.harga_gross, disc_pct_num);

    const harga_beli_satuan =
      disc_net_computed ?? product.harga_per_pcs ?? product.harga_net ?? product.harga ?? product.harga_daftar ?? null;

    const harga_beli_grosir =
      product.harga_per_lusin ??
      product.harga_per_pak ??
      product.harga_per_kotak ??
      product.harga_per_karton ??
      null;

    const harga_per_pcs_derived =
      product.harga_per_pcs == null && product.harga_per_lusin != null
        ? Math.round(product.harga_per_lusin / 12)
        : null;

    const margin =
      product.harga_jual != null && harga_beli_satuan != null
        ? product.harga_jual - harga_beli_satuan
        : null;

    const margin_pct =
      margin != null && harga_beli_satuan != null && harga_beli_satuan > 0
        ? Math.round((margin / harga_beli_satuan) * 100 * 100) / 100
        : null;

    return {
      ...product,
      disc_pct: disc_pct_num,
      disc_net_computed,
      harga_beli_satuan,
      harga_beli_grosir,
      harga_per_pcs_derived,
      margin,
      margin_pct,
    };
  }

  async findAll(params: {
    search?: string;
    brand_id?: number;
    page?: number;
    limit?: number;
    sort_by?: 'name' | 'brand' | 'created_at';
    sort_dir?: 'asc' | 'desc';
    deleted?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;
    const sortBy = params.sort_by ?? 'name';
    const sortDir = params.sort_dir ?? 'asc';

    const where: any = {
      deleted_at: params.deleted ? { not: null } : null,
    };

    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    if (params.brand_id) {
      where.brand_id = params.brand_id;
    }

    const orderBy =
      sortBy === 'brand'
        ? { brand: { name: sortDir } }
        : params.deleted
          ? { deleted_at: 'desc' as const }
          : { [sortBy]: sortDir };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { brand: { select: { id: true, name: true } } },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((p) => this.computeFields(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number, opts?: { includeDeleted?: boolean }) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { brand: { select: { id: true, name: true } } },
    });

    if (!product || (!opts?.includeDeleted && product.deleted_at != null)) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    return this.computeFields(product);
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: dto,
      include: { brand: { select: { id: true, name: true } } },
    });

    return this.computeFields(product);
  }

  async update(id: number, dto: UpdateProductDto) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: { brand: { select: { id: true, name: true } } },
    });

    this.priceHistoryService
      .recordChanges({
        product_id: id,
        old_product: before,
        new_product: product,
        source: 'app',
      })
      .catch((err) =>
        this.logger.warn(`History log failed: ${err.message}`),
      );

    return this.computeFields(product);
  }

  async remove(id: number) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists || exists.deleted_at != null) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    await this.prisma.product.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
    return { success: true };
  }

  async restore(id: number) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists || exists.deleted_at == null) {
      throw new NotFoundException(`Deleted product #${id} not found`);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { deleted_at: null },
      include: { brand: { select: { id: true, name: true } } },
    });
    return this.computeFields(product);
  }

  async permanentRemove(id: number) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }
}
