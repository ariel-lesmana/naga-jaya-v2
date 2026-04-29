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
  deleted_at: string | null;
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

export interface DuplicateMatch {
  id: number;
  name: string;
  score: number;
  match_type: 'exact' | 'similar';
}

export interface DuplicateCheckResponse {
  matches: DuplicateMatch[];
}

export interface BulkCreateRowResult {
  index: number;
  success: boolean;
  product?: ProductResponse;
  error?: string;
}

export interface BulkCreateResult {
  results: BulkCreateRowResult[];
  inserted: number;
  errors: number;
}

export interface BulkUpdateRowResult {
  index: number;
  id: number;
  success: boolean;
  product?: ProductResponse;
  error?: string;
}

export interface BulkUpdateResult {
  results: BulkUpdateRowResult[];
  updated: number;
  errors: number;
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

export interface AuditLogRow {
  id: number;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  error_message: string | null;
  ip: string | null;
  created_at: string;
}

export interface AuditLogDetail extends AuditLogRow {
  query: unknown;
  request_body: unknown;
  response_body: unknown;
  user_agent: string | null;
}

export interface AuditLogList {
  data: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  method?: string;
  path?: string;
  from?: string;
  to?: string;
  status_min?: number;
}

export type ReceiptStatus = 'DRAFT' | 'FINALIZED';
export type ReceiptUnit = 'pcs' | 'lusin' | 'pak' | 'kotak' | 'karton';

export const RECEIPT_UNITS: ReceiptUnit[] = ['pcs', 'lusin', 'pak', 'kotak', 'karton'];

export const PRICE_FIELD: Record<ReceiptUnit, keyof ReceiptItemProduct> = {
  pcs: 'harga_jual',
  lusin: 'harga_jual_per_lusin',
  pak: 'harga_jual_per_pak',
  kotak: 'harga_jual_per_kotak',
  karton: 'harga_jual_per_karton',
};

export interface ReceiptItemProduct {
  id: number;
  name: string;
  brand_id: number;
  harga_jual: number | null;
  harga_jual_per_lusin: number | null;
  harga_jual_per_pak: number | null;
  harga_jual_per_kotak: number | null;
  harga_jual_per_karton: number | null;
  deleted_at: string | null;
}

export interface ReceiptItem {
  id: number;
  receipt_id: number;
  product_id: number | null;
  product: ReceiptItemProduct | null;
  product_name_snapshot: string | null;
  quantity: number | null;
  unit_type: ReceiptUnit | null;
  price_snapshot: number | null;
  discount_per_unit: number | null;
  line_total_override: number | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: number;
  customer_name: string | null;
  status: ReceiptStatus;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  items: ReceiptItem[];
}

export interface ReceiptListRow {
  id: number;
  customer_name: string | null;
  status: ReceiptStatus;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
}

export interface PaginatedReceipts {
  data: ReceiptListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReceiptItemInput {
  id?: number;
  product_id?: number | null;
  quantity?: number | null;
  unit_type?: ReceiptUnit | null;
  discount_per_unit?: number | null;
  line_total_override?: number | null;
  notes?: string | null;
  position?: number;
}
