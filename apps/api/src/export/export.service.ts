import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

export interface ExportFilters {
  brand_id?: number;
  include_no_sell_price?: boolean;
}

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  private computeMargin(product: any) {
    const disc_pct_num =
      product.disc_pct != null ? Number(product.disc_pct) : null;
    const disc_net =
      product.harga_gross != null && disc_pct_num != null
        ? Math.round(product.harga_gross * (1 - disc_pct_num / 100))
        : null;

    const harga_beli =
      disc_net ??
      product.harga_per_pcs ??
      product.harga_net ??
      product.harga ??
      product.harga_daftar ??
      null;

    const margin =
      product.harga_jual != null && harga_beli != null
        ? product.harga_jual - harga_beli
        : null;

    const margin_pct =
      margin != null && harga_beli != null && harga_beli > 0
        ? Math.round((margin / harga_beli) * 100 * 100) / 100
        : null;

    return { margin, margin_pct };
  }

  async generateExcel(filters?: ExportFilters): Promise<Buffer> {
    const where: any = {};
    if (filters?.brand_id) {
      where.brand_id = filters.brand_id;
    }
    if (filters?.include_no_sell_price === false) {
      where.harga_jual = { not: null };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { brand: { select: { id: true, name: true } } },
      orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
    });

    const workbook = XLSX.utils.book_new();

    const allColumns = [
      'Nama Barang',
      'Harga Gross',
      'Disc %',
      'Harga Per Pcs',
      'Harga Per Lusin',
      'Harga Per Karton',
      'Harga Per Pak',
      'Harga Net',
      'Harga Daftar',
      'Harga',
      'Harga Jual',
      'Harga Jual Per Lusin',
      'Harga Jual Per Karton',
      'Harga Jual Per Kotak',
      'Harga Jual Per Pak',
      'Margin',
      'Margin %',
    ];

    const fieldMap: Record<string, (p: any) => any> = {
      'Nama Barang': (p) => p.name,
      'Harga Gross': (p) => p.harga_gross,
      'Disc %': (p) => (p.disc_pct != null ? Number(p.disc_pct) : null),
      'Harga Per Pcs': (p) => p.harga_per_pcs,
      'Harga Per Lusin': (p) => p.harga_per_lusin,
      'Harga Per Karton': (p) => p.harga_per_karton,
      'Harga Per Pak': (p) => p.harga_per_pak,
      'Harga Net': (p) => p.harga_net,
      'Harga Daftar': (p) => p.harga_daftar,
      'Harga': (p) => p.harga,
      'Harga Jual': (p) => p.harga_jual,
      'Harga Jual Per Lusin': (p) => p.harga_jual_per_lusin,
      'Harga Jual Per Karton': (p) => p.harga_jual_per_karton,
      'Harga Jual Per Kotak': (p) => p.harga_jual_per_kotak,
      'Harga Jual Per Pak': (p) => p.harga_jual_per_pak,
      'Margin': (p) => this.computeMargin(p).margin,
      'Margin %': (p) => this.computeMargin(p).margin_pct,
    };

    // Group by brand
    const brandGroups = new Map<string, any[]>();
    for (const p of products) {
      const name = p.brand.name;
      if (!brandGroups.has(name)) brandGroups.set(name, []);
      brandGroups.get(name)!.push(p);
    }

    // "Semua Produk" sheet first
    this.addSheet(
      workbook,
      'Semua Produk',
      products,
      allColumns,
      fieldMap,
      true,
    );

    // Per-brand sheets
    for (const [brandName, brandProducts] of brandGroups) {
      const sheetName = brandName.replace(/[:\\/?*\[\]]/g, '').substring(0, 31);
      this.addSheet(
        workbook,
        sheetName,
        brandProducts,
        allColumns,
        fieldMap,
        false,
      );
    }

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf);
  }

  private addSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
    products: any[],
    allColumns: string[],
    fieldMap: Record<string, (p: any) => any>,
    includeBrandCol: boolean,
  ) {
    // Determine which columns have data
    const activeColumns = allColumns.filter((col) => {
      if (col === 'Nama Barang') return true;
      return products.some((p) => {
        const val = fieldMap[col](p);
        return val != null;
      });
    });

    if (includeBrandCol) {
      activeColumns.splice(1, 0, 'Brand');
    }

    // Row 1: brand/sheet name header
    const headerRow = [sheetName];

    // Row 2: column headers
    const colHeaders = activeColumns;

    // Data rows
    const dataRows = products.map((p) =>
      activeColumns.map((col) => {
        if (col === 'Brand') return p.brand.name;
        return fieldMap[col](p);
      }),
    );

    const sheetData = [headerRow, colHeaders, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Merge row 1 across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: activeColumns.length - 1 } },
    ];

    // Style: header row (row 1 = brand name)
    const headerCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    if (headerCell) {
      headerCell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E79' } },
        alignment: { horizontal: 'center' },
      };
    }

    // Style column headers (row 2)
    for (let c = 0; c < activeColumns.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
      if (cell) {
        cell.s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'DEEAF1' } },
        };
      }
    }

    // Style data rows with alternating colors
    for (let r = 0; r < dataRows.length; r++) {
      for (let c = 0; c < activeColumns.length; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: r + 2, c })];
        if (cell && r % 2 === 1) {
          cell.s = { fill: { fgColor: { rgb: 'F7F7F5' } } };
        }
      }
    }

    // Column widths
    const colWidths = activeColumns.map((col) => {
      let maxLen = col.length;
      for (const row of dataRows) {
        const idx = activeColumns.indexOf(col);
        const val = row[idx];
        if (val != null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return { wch: Math.max(12, Math.min(40, maxLen + 2)) };
    });
    ws['!cols'] = colWidths;

    // Freeze top 2 rows
    ws['!freeze'] = { xSplit: 0, ySplit: 2 };
    // SheetJS uses '!freeze' or we set views
    if (!ws['!views']) ws['!views'] = [];
    (ws['!views'] as any[]).push({ state: 'frozen', ySplit: 2 });

    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }

  generateTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();

    // Products sheet
    const headers = [
      'Nama Barang',
      'Brand',
      'Harga Gross',
      'Disc %',
      'Harga Per Pcs',
      'Harga Per Lusin',
      'Harga Per Karton',
      'Harga Per Pak',
      'Harga Net',
      'Harga Daftar',
      'Harga',
      'Harga Jual',
      'Harga Jual Per Lusin',
      'Harga Jual Per Karton',
      'Harga Jual Per Kotak',
      'Harga Jual Per Pak',
    ];

    const exampleRows = [
      [
        'CASABLANCA DEO SPRAY 100ML',
        'CASABLANCA',
        25000,
        10,
        22500,
        250000,
        null,
        null,
        22500,
        25000,
        22500,
        27000,
        null,
        null,
        null,
        null,
      ],
      [
        'MARINA NATURAL HAND BODY 200ML',
        'MARINA',
        18000,
        5,
        17100,
        190000,
        null,
        null,
        17100,
        18000,
        17100,
        21000,
        null,
        null,
        null,
        null,
      ],
      [
        'WARDAH LIGHTENING DAY CREAM 30G',
        'WARDAH',
        35000,
        null,
        35000,
        400000,
        null,
        null,
        35000,
        35000,
        35000,
        42000,
        null,
        null,
        null,
        null,
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);

    // Column widths
    ws['!cols'] = headers.map((h) => ({
      wch: Math.max(14, h.length + 2),
    }));

    // Style headers
    for (let c = 0; c < headers.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) {
        cell.s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'DEEAF1' } },
        };
      }
    }

    XLSX.utils.book_append_sheet(workbook, ws, 'products');

    // Petunjuk sheet
    const petunjukHeaders = ['Kolom', 'Wajib', 'Keterangan'];
    const petunjukData = [
      ['Nama Barang', 'Ya', 'Nama lengkap produk'],
      ['Brand', 'Ya', 'Nama brand/merek produk'],
      ['Harga Gross', 'Tidak', 'Harga gross sebelum diskon'],
      ['Disc %', 'Tidak', 'Persentase diskon (angka saja, tanpa %)'],
      ['Harga Per Pcs', 'Tidak', 'Harga per satuan/pcs'],
      ['Harga Per Lusin', 'Tidak', 'Harga per lusin (12 pcs)'],
      ['Harga Per Karton', 'Tidak', 'Harga per karton'],
      ['Harga Per Pak', 'Tidak', 'Harga per pak'],
      ['Harga Net', 'Tidak', 'Harga net setelah diskon'],
      ['Harga Daftar', 'Tidak', 'Harga daftar/katalog'],
      ['Harga', 'Tidak', 'Harga umum'],
      ['Harga Jual', 'Tidak', 'Harga jual ke konsumen (per pcs)'],
      ['Harga Jual Per Lusin', 'Tidak', 'Harga jual per lusin (12 pcs)'],
      ['Harga Jual Per Karton', 'Tidak', 'Harga jual per karton'],
      ['Harga Jual Per Kotak', 'Tidak', 'Harga jual per kotak'],
      ['Harga Jual Per Pak', 'Tidak', 'Harga jual per pak'],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet([petunjukHeaders, ...petunjukData]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 45 }];

    for (let c = 0; c < petunjukHeaders.length; c++) {
      const cell = ws2[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) {
        cell.s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'DEEAF1' } },
        };
      }
    }

    XLSX.utils.book_append_sheet(workbook, ws2, 'Petunjuk');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf);
  }
}
