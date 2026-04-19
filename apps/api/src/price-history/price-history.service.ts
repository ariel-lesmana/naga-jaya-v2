import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TRACKED_FIELDS = [
  'harga_per_karton',
  'harga_per_kotak',
  'harga_per_pak',
  'harga_per_lusin',
  'harga_per_pcs',
  'harga_net',
  'harga_daftar',
  'harga',
  'harga_jual',
  'harga_jual_per_lusin',
  'harga_jual_per_karton',
  'harga_jual_per_kotak',
  'harga_jual_per_pak',
  'harga_gross',
  'disc_pct',
];

const FIELD_LABELS: Record<string, string> = {
  harga_per_karton: 'Harga Per Karton',
  harga_per_kotak: 'Harga Per Kotak',
  harga_per_pak: 'Harga Per Pak',
  harga_per_lusin: 'Harga Per Lusin',
  harga_per_pcs: 'Harga Per Pcs',
  harga_net: 'Harga Net',
  harga_daftar: 'Harga Daftar',
  harga: 'Harga Umum',
  harga_jual: 'Harga Jual',
  harga_jual_per_lusin: 'Harga Jual Per Lusin',
  harga_jual_per_karton: 'Harga Jual Per Karton',
  harga_jual_per_kotak: 'Harga Jual Per Kotak',
  harga_jual_per_pak: 'Harga Jual Per Pak',
  harga_gross: 'Harga Gross Supplier',
  disc_pct: 'Diskon (%)',
};

const SOURCE_LABELS: Record<string, string> = {
  app: 'Diubah di App',
  import: 'Import Excel',
  excel: 'Sync OneDrive',
};

export interface RecordChangesParams {
  product_id: number;
  old_product: Record<string, any>;
  new_product: Record<string, any>;
  source: 'app' | 'import' | 'excel';
  changed_by?: string;
  tx?: any; // Prisma transaction client
}

function toInt(val: any): number | null {
  if (val == null) return null;
  return Number(val);
}

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return `${Math.max(1, diffMin)} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'kemarin';
  }

  if (diffDay < 7) return `${diffDay} hari lalu`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} minggu lalu`;

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const d = date.getDate().toString().padStart(2, '0');
  return `${d} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

@Injectable()
export class PriceHistoryService {
  constructor(private prisma: PrismaService) {}

  async recordChanges(params: RecordChangesParams): Promise<void> {
    const { product_id, old_product, new_product, source, changed_by, tx } =
      params;

    const data: {
      product_id: number;
      field: string;
      old_value: number | null;
      new_value: number | null;
      source: string;
      changed_by: string | null;
    }[] = [];

    for (const field of TRACKED_FIELDS) {
      const oldVal = toInt(old_product[field]);
      const newVal = toInt(new_product[field]);

      // Skip if both null
      if (oldVal == null && newVal == null) continue;
      // Skip if no change
      if (oldVal === newVal) continue;

      data.push({
        product_id,
        field,
        old_value: oldVal,
        new_value: newVal,
        source,
        changed_by: changed_by ?? null,
      });
    }

    if (data.length === 0) return;

    const client = tx || this.prisma;
    await client.priceHistory.createMany({ data });
  }

  async recordChangesBatch(
    entries: {
      product_id: number;
      old_product: Record<string, any>;
      new_product: Record<string, any>;
    }[],
    source: 'app' | 'import' | 'excel',
    changed_by?: string,
    tx?: any,
  ): Promise<void> {
    const data: {
      product_id: number;
      field: string;
      old_value: number | null;
      new_value: number | null;
      source: string;
      changed_by: string | null;
    }[] = [];

    for (const entry of entries) {
      for (const field of TRACKED_FIELDS) {
        const oldVal = toInt(entry.old_product[field]);
        const newVal = toInt(entry.new_product[field]);
        if (oldVal == null && newVal == null) continue;
        if (oldVal === newVal) continue;

        data.push({
          product_id: entry.product_id,
          field,
          old_value: oldVal,
          new_value: newVal,
          source,
          changed_by: changed_by ?? null,
        });
      }
    }

    if (data.length === 0) return;

    const client = tx || this.prisma;
    await client.priceHistory.createMany({ data });
  }

  async getHistory(
    productId: number,
    options?: { field?: string; limit?: number; before?: Date },
  ) {
    const limit = options?.limit ?? 50;
    const where: any = { product_id: productId };

    if (options?.field) {
      where.field = options.field;
    }
    if (options?.before) {
      where.created_at = { lt: options.before };
    }

    const entries = await this.prisma.priceHistory.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit + 1,
    });

    const has_more = entries.length > limit;
    if (has_more) entries.pop();

    return {
      entries: entries.map((e) => {
        const old_value = e.old_value;
        const new_value = e.new_value;
        const change_amount =
          old_value != null && new_value != null
            ? new_value - old_value
            : null;
        const change_pct =
          change_amount != null && old_value != null && old_value !== 0
            ? Math.round((change_amount / old_value) * 100 * 100) / 100
            : null;

        return {
          id: e.id,
          field: e.field,
          field_label: FIELD_LABELS[e.field] || e.field,
          old_value,
          new_value,
          change_amount,
          change_pct,
          source: e.source,
          source_label: SOURCE_LABELS[e.source] || e.source,
          changed_by: e.changed_by,
          created_at: e.created_at.toISOString(),
          relative_time: relativeTime(e.created_at),
        };
      }),
      has_more,
    };
  }

  async getSummary(options?: {
    days?: number;
    brand_id?: number;
    limit?: number;
  }) {
    const days = options?.days ?? 7;
    const limit = options?.limit ?? 20;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: any = {
      created_at: { gte: since },
    };
    if (options?.brand_id) {
      where.product = { brand_id: options.brand_id };
    }

    // Get all history entries in the period, with product info
    const entries = await this.prisma.priceHistory.findMany({
      where,
      include: {
        product: {
          include: { brand: { select: { name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Group by product_id
    const grouped = new Map<
      number,
      {
        product_id: number;
        product_name: string;
        brand_name: string;
        entries: typeof entries;
      }
    >();

    for (const e of entries) {
      if (!grouped.has(e.product_id)) {
        grouped.set(e.product_id, {
          product_id: e.product_id,
          product_name: e.product.name,
          brand_name: e.product.brand.name,
          entries: [],
        });
      }
      grouped.get(e.product_id)!.entries.push(e);
    }

    const results = Array.from(grouped.values())
      .map((g) => {
        const sorted = g.entries.sort(
          (a, b) => b.created_at.getTime() - a.created_at.getTime(),
        );
        const last_changed_at = sorted[0].created_at;

        const fieldsChanged = new Set(sorted.map((e) => e.field));
        const fields_changed = Array.from(fieldsChanged).map(
          (f) => FIELD_LABELS[f] || f,
        );

        // Find harga_jual changes
        const hjEntries = sorted.filter((e) => e.field === 'harga_jual');
        let harga_jual_old: number | null = null;
        let harga_jual_new: number | null = null;
        let harga_jual_diff: number | null = null;

        if (hjEntries.length > 0) {
          // oldest old_value and newest new_value in the period
          harga_jual_old = hjEntries[hjEntries.length - 1].old_value;
          harga_jual_new = hjEntries[0].new_value;
          harga_jual_diff =
            harga_jual_old != null && harga_jual_new != null
              ? harga_jual_new - harga_jual_old
              : null;
        }

        return {
          product_id: g.product_id,
          product_name: g.product_name,
          brand_name: g.brand_name,
          last_changed_at: last_changed_at.toISOString(),
          relative_time: relativeTime(last_changed_at),
          changes_count: sorted.length,
          fields_changed,
          harga_jual_old,
          harga_jual_new,
          harga_jual_diff,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.last_changed_at).getTime() -
          new Date(a.last_changed_at).getTime(),
      )
      .slice(0, limit);

    return results;
  }
}
