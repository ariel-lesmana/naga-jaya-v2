export interface Brand {
  id: number;
  name: string;
}

export interface ProductResponse {
  id: number;
  brand_id: number;
  brand: Brand;
  name: string;
  harga_per_karton: number | null;
  harga_per_kotak: number | null;
  harga_per_pak: number | null;
  harga_per_lusin: number | null;
  harga_per_pcs: number | null;
  harga_net: number | null;
  harga_daftar: number | null;
  harga: number | null;
  harga_jual: number | null;
  harga_jual_per_lusin: number | null;
  harga_jual_per_karton: number | null;
  harga_jual_per_kotak: number | null;
  harga_jual_per_pak: number | null;
  harga_gross: number | null;
  disc_pct: number | null;
  created_at: string;
  disc_net_computed: number | null;
  harga_beli_satuan: number | null;
  harga_beli_grosir: number | null;
  harga_per_pcs_derived: number | null;
  margin: number | null;
  margin_pct: number | null;
}

export interface PaginatedProducts {
  data: ProductResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  name: string;
  brand_id: number;
  harga_per_karton?: number | null;
  harga_per_kotak?: number | null;
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
  harga_gross?: number | null;
  disc_pct?: number | null;
}

export interface UpdateProductDto {
  name?: string;
  brand_id?: number;
  harga_per_karton?: number | null;
  harga_per_kotak?: number | null;
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
  harga_gross?: number | null;
  disc_pct?: number | null;
}

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
  existing: ProductResponse;
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

export interface HistoryEntry {
  id: number;
  field: string;
  field_label: string;
  old_value: number | null;
  new_value: number | null;
  change_amount: number | null;
  change_pct: number | null;
  source: string;
  source_label: string;
  changed_by: string | null;
  created_at: string;
  relative_time: string;
}

export interface PriceHistoryResponse {
  entries: HistoryEntry[];
  has_more: boolean;
}

export interface SummaryEntry {
  product_id: number;
  product_name: string;
  brand_name: string;
  last_changed_at: string;
  relative_time: string;
  changes_count: number;
  fields_changed: string[];
  harga_jual_old: number | null;
  harga_jual_new: number | null;
  harga_jual_diff: number | null;
}
