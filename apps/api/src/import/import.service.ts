import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriceHistoryService } from '../price-history/price-history.service';
import * as XLSX from 'xlsx';

export interface ParsedRow {
  row_index: number;
  name: string;
  brand_name: string;
  harga_gross?: number | null;
  disc_pct?: number | null;
  harga_per_karton?: number | null;
  harga_per_pak?: number | null;
  harga_per_lusin?: number | null;
  harga_per_pcs?: number | null;
  harga_net?: number | null;
  harga_daftar?: number | null;
  harga?: number | null;
  harga_jual?: number | null;
  harga_jual_per_lusin?: number | null;
  harga_jual_per_karton?: number | null;
  harga_jual_per_kotak?: number | null;
  harga_jual_per_pak?: number | null;
}

export interface DiffRow {
  existing: any;
  incoming: ParsedRow;
  changed_fields: string[];
}

export interface DiffResult {
  new_products: ParsedRow[];
  updated_products: DiffRow[];
  unchanged_products: ParsedRow[];
  unknown_brands: string[];
}

export interface ImportOptions {
  create_new: boolean;
  update_existing: boolean;
  create_brands: boolean;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; name: string; reason: string }[];
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  'nama barang': 'name',
  'brand': 'brand_name',
  'harga gross': 'harga_gross',
  'disc %': 'disc_pct',
  'harga per pcs': 'harga_per_pcs',
  'harga per lusin': 'harga_per_lusin',
  'harga per karton': 'harga_per_karton',
  'harga per pak': 'harga_per_pak',
  'harga net': 'harga_net',
  'harga daftar': 'harga_daftar',
  'harga': 'harga',
  'harga jual': 'harga_jual',
  'harga jual per lusin': 'harga_jual_per_lusin',
  'harga jual per karton': 'harga_jual_per_karton',
  'harga jual per kotak': 'harga_jual_per_kotak',
  'harga jual per pak': 'harga_jual_per_pak',
};

function parsePrice(value: any): number | null {
  if (value == null || value === '') return null;
  let str = String(value).trim();
  // Strip Rp prefix and spaces
  str = str.replace(/^Rp\s*/i, '');
  // Remove dots used as thousand separators (but not decimal commas)
  str = str.replace(/\./g, '');
  // Replace comma with dot for decimal
  str = str.replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  const rounded = Math.round(num);
  if (rounded > 10_000_000) return null;
  return rounded;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private prisma: PrismaService,
    private priceHistoryService: PriceHistoryService,
  ) {}

  parseExcelBuffer(buffer: Buffer): ParsedRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName =
      workbook.SheetNames.find(
        (n) => n.toLowerCase().trim() === 'products',
      ) || workbook.SheetNames[0];

    if (!sheetName) {
      throw new BadRequestException('File Excel tidak memiliki sheet');
    }

    const sheet = workbook.Sheets[sheetName];

    // Try parsing with row 1 as header first; if required columns are missing,
    // retry starting from row 2 (exported files have a merged brand header in row 1)
    let rawData: any[];
    let headerMapping: Record<string, keyof ParsedRow> = {};

    for (const startRow of [0, 1]) {
      const opts: any = { defval: null };
      if (startRow > 0) {
        // Tell sheet_to_json to treat row at index startRow as the header
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        range.s.r = startRow;
        opts.range = range;
      }
      rawData = XLSX.utils.sheet_to_json(sheet, opts);

      if (rawData.length === 0) continue;

      headerMapping = {};
      const firstRow = rawData[0];
      for (const key of Object.keys(firstRow)) {
        const normalized = key.toLowerCase().trim();
        if (COLUMN_MAP[normalized]) {
          headerMapping[key] = COLUMN_MAP[normalized];
        }
      }

      const mappedFields = Object.values(headerMapping);
      if (mappedFields.includes('name')) break; // found valid headers
    }

    rawData = rawData!;
    if (rawData.length === 0) {
      throw new BadRequestException('Sheet kosong');
    }

    const mappedFields = Object.values(headerMapping);
    const missingRequired: string[] = [];
    if (!mappedFields.includes('name')) missingRequired.push('Nama Barang');
    if (!mappedFields.includes('brand_name')) missingRequired.push('Brand');

    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Kolom wajib tidak ditemukan: ${missingRequired.join(', ')}`,
      );
    }

    const rows: ParsedRow[] = [];
    for (let i = 0; i < rawData.length; i++) {
      const raw = rawData[i];
      const row: any = { row_index: i };

      for (const [excelCol, fieldName] of Object.entries(headerMapping)) {
        const val = raw[excelCol];
        if (fieldName === 'name' || fieldName === 'brand_name') {
          row[fieldName] = val != null ? String(val).trim() : '';
        } else {
          row[fieldName] = parsePrice(val);
        }
      }

      // Skip rows with empty name
      if (!row.name) continue;
      if (!row.brand_name) continue;

      rows.push(row as ParsedRow);
    }

    return rows;
  }

  async diffWithDatabase(rows: ParsedRow[]): Promise<DiffResult> {
    const allProducts = await this.prisma.product.findMany({
      where: { deleted_at: null },
      include: { brand: { select: { id: true, name: true } } },
    });

    const allBrands = await this.prisma.brand.findMany();
    const brandNameSet = new Set(allBrands.map((b) => b.name.toLowerCase()));

    // Build lookup: "name|brand_name" -> product
    const dbLookup = new Map<string, any>();
    for (const p of allProducts) {
      const key = `${p.name.toLowerCase()}|${p.brand.name.toLowerCase()}`;
      dbLookup.set(key, p);
    }

    const priceFields = [
      'harga_gross',
      'disc_pct',
      'harga_per_karton',
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
    ];

    const new_products: ParsedRow[] = [];
    const updated_products: DiffRow[] = [];
    const unchanged_products: ParsedRow[] = [];
    const unknownBrandsSet = new Set<string>();

    for (const row of rows) {
      // Check unknown brands
      if (!brandNameSet.has(row.brand_name.toLowerCase())) {
        unknownBrandsSet.add(row.brand_name);
      }

      const key = `${row.name.toLowerCase()}|${row.brand_name.toLowerCase()}`;
      const existing = dbLookup.get(key);

      if (!existing) {
        new_products.push(row);
        continue;
      }

      // Compare price fields
      const changed_fields: string[] = [];
      for (const field of priceFields) {
        const incomingVal = (row as any)[field] ?? null;
        let existingVal = existing[field] ?? null;
        // disc_pct is Decimal in DB, convert to number
        if (field === 'disc_pct' && existingVal != null) {
          existingVal = Number(existingVal);
        }
        if (incomingVal !== existingVal) {
          // Only count as changed if incoming is not null (don't clear existing values)
          if (incomingVal != null) {
            changed_fields.push(field);
          }
        }
      }

      if (changed_fields.length > 0) {
        updated_products.push({ existing, incoming: row, changed_fields });
      } else {
        unchanged_products.push(row);
      }
    }

    return {
      new_products,
      updated_products,
      unchanged_products,
      unknown_brands: Array.from(unknownBrandsSet),
    };
  }

  async commitImport(
    rows: ParsedRow[],
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Get or create brand map
    const allBrands = await this.prisma.brand.findMany();
    const brandMap = new Map<string, number>();
    for (const b of allBrands) {
      brandMap.set(b.name.toLowerCase(), b.id);
    }

    // Get existing products lookup (active only — soft-deleted treated as new)
    const allProducts = await this.prisma.product.findMany({
      where: { deleted_at: null },
      include: { brand: { select: { id: true, name: true } } },
    });
    const dbLookup = new Map<string, any>();
    for (const p of allProducts) {
      const key = `${p.name.toLowerCase()}|${p.brand.name.toLowerCase()}`;
      dbLookup.set(key, p);
    }

    const priceFields = [
      'harga_gross',
      'disc_pct',
      'harga_per_karton',
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
    ];

    const historyEntries: {
      product_id: number;
      old_product: Record<string, any>;
      new_product: Record<string, any>;
    }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        try {
          let brandId = brandMap.get(row.brand_name.toLowerCase());

          if (!brandId) {
            if (!options.create_brands) {
              result.skipped++;
              continue;
            }
            const newBrand = await tx.brand.create({
              data: { name: row.brand_name },
            });
            brandId = newBrand.id;
            brandMap.set(row.brand_name.toLowerCase(), brandId);
          }

          const key = `${row.name.toLowerCase()}|${row.brand_name.toLowerCase()}`;
          const existing = dbLookup.get(key);

          if (existing) {
            if (!options.update_existing) {
              result.skipped++;
              continue;
            }

            const updateData: any = {};
            for (const field of priceFields) {
              const val = (row as any)[field];
              if (val != null) {
                updateData[field] = val;
              }
            }

            if (Object.keys(updateData).length > 0) {
              const updated = await tx.product.update({
                where: { id: existing.id },
                data: updateData,
              });
              historyEntries.push({
                product_id: existing.id,
                old_product: existing,
                new_product: updated,
              });
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            if (!options.create_new) {
              result.skipped++;
              continue;
            }

            const createData: any = {
              name: row.name,
              brand_id: brandId,
            };
            for (const field of priceFields) {
              const val = (row as any)[field];
              if (val != null) {
                createData[field] = val;
              }
            }

            const created = await tx.product.create({ data: createData });
            historyEntries.push({
              product_id: created.id,
              old_product: {},
              new_product: created,
            });
            result.inserted++;
          }
        } catch (err: any) {
          result.errors.push({
            row: row.row_index,
            name: row.name,
            reason: err.message || 'Unknown error',
          });
        }
      }

      // Batch insert all history entries inside the transaction
      if (historyEntries.length > 0) {
        await this.priceHistoryService
          .recordChangesBatch(historyEntries, 'import', undefined, tx)
          .catch((err) =>
            this.logger.warn(`Import history log failed: ${err.message}`),
          );
      }
    });

    return result;
  }
}
