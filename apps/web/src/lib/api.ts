import {
  Brand,
  PaginatedProducts,
  ProductResponse,
  CreateProductDto,
  UpdateProductDto,
  DiffResult,
  ParsedRow,
  ImportOptions,
  ImportResult,
  PriceHistoryResponse,
  SummaryEntry,
  BulkCreateResult,
  BulkUpdateResult,
  DuplicateCheckResponse,
  AuditLogList,
  AuditLogDetail,
  AuditLogFilters,
  Receipt,
  ReceiptItemInput,
  ReceiptStatus,
  PaginatedReceipts,
} from './types';

import { env } from './env';

const API_URL = env.NEXT_PUBLIC_API_URL;

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${res.status}`);
  }
  return res.json();
}

export function getBrands(): Promise<Brand[]> {
  return fetchAPI('/brands');
}

export function createBrand(dto: { name: string; source_sheet?: string }): Promise<Brand> {
  return fetchAPI('/brands', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function getProducts(params: {
  search?: string;
  brand_id?: number;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'brand' | 'created_at';
  sort_dir?: 'asc' | 'desc';
}): Promise<PaginatedProducts> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.brand_id) query.set('brand_id', String(params.brand_id));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.sort_by) query.set('sort_by', params.sort_by);
  if (params.sort_dir) query.set('sort_dir', params.sort_dir);
  return fetchAPI(`/products?${query.toString()}`);
}

export function getProduct(id: number): Promise<ProductResponse> {
  return fetchAPI(`/products/${id}`);
}

export function checkProductDuplicates(params: {
  brand_id: number;
  name: string;
}): Promise<DuplicateCheckResponse> {
  const q = new URLSearchParams({
    brand_id: String(params.brand_id),
    name: params.name,
  });
  return fetchAPI(`/products/duplicate-check?${q.toString()}`);
}

export function createProduct(dto: CreateProductDto): Promise<ProductResponse> {
  return fetchAPI('/products', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function bulkCreateProducts(products: CreateProductDto[]): Promise<BulkCreateResult> {
  return fetchAPI('/products/bulk', {
    method: 'POST',
    body: JSON.stringify({ products }),
  });
}

export function bulkUpdateProducts(
  updates: { id: number; patch: UpdateProductDto }[],
): Promise<BulkUpdateResult> {
  return fetchAPI('/products/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  });
}

export function updateProduct(
  id: number,
  dto: UpdateProductDto,
): Promise<ProductResponse> {
  return fetchAPI(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function deleteProduct(id: number): Promise<{ success: boolean }> {
  return fetchAPI(`/products/${id}`, { method: 'DELETE' });
}

export function restoreProduct(id: number): Promise<ProductResponse> {
  return fetchAPI(`/products/${id}/restore`, { method: 'PATCH' });
}

export function permanentDeleteProduct(
  id: number,
): Promise<{ success: boolean }> {
  return fetchAPI(`/products/${id}/permanent`, { method: 'DELETE' });
}

export function getDeletedProducts(params: {
  search?: string;
  brand_id?: number;
  page?: number;
  limit?: number;
}): Promise<PaginatedProducts> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.brand_id) query.set('brand_id', String(params.brand_id));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  return fetchAPI(`/products/trash?${query.toString()}`);
}

export async function previewImport(
  file: File,
): Promise<{ rows: ParsedRow[]; diff: DiffResult }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/import/preview`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${res.status}`);
  }
  return res.json();
}

export function commitImport(
  rows: ParsedRow[],
  options: ImportOptions,
): Promise<ImportResult> {
  return fetchAPI('/import/commit', {
    method: 'POST',
    body: JSON.stringify({ rows, options }),
  });
}

export async function exportExcel(brandId?: number): Promise<Blob> {
  const query = new URLSearchParams();
  if (brandId) query.set('brand_id', String(brandId));
  const res = await fetch(`${API_URL}/export?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Export failed');
  }
  return res.blob();
}

export function getProductHistory(
  id: number,
  options?: { field?: string; limit?: number; before?: string },
): Promise<PriceHistoryResponse> {
  const query = new URLSearchParams();
  if (options?.field) query.set('field', options.field);
  if (options?.limit) query.set('limit', String(options.limit));
  if (options?.before) query.set('before', options.before);
  return fetchAPI(`/products/${id}/history?${query.toString()}`);
}

export function getHistorySummary(options?: {
  days?: number;
  brand_id?: number;
  limit?: number;
}): Promise<SummaryEntry[]> {
  const query = new URLSearchParams();
  if (options?.days) query.set('days', String(options.days));
  if (options?.brand_id) query.set('brand_id', String(options.brand_id));
  if (options?.limit) query.set('limit', String(options.limit));
  return fetchAPI(`/history/summary?${query.toString()}`);
}

async function adminFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token,
    },
  });
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${res.status}`);
  }
  return res.json();
}

export function getAuditLogs(
  token: string,
  filters: AuditLogFilters = {},
): Promise<AuditLogList> {
  const query = new URLSearchParams();
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  if (filters.method) query.set('method', filters.method);
  if (filters.path) query.set('path', filters.path);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.status_min) query.set('status_min', String(filters.status_min));
  const qs = query.toString();
  return adminFetch(`/logs${qs ? `?${qs}` : ''}`, token);
}

export function getAuditLog(
  token: string,
  id: number,
): Promise<AuditLogDetail> {
  return adminFetch(`/logs/${id}`, token);
}

export function listReceipts(params: {
  status?: ReceiptStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedReceipts> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return fetchAPI(`/receipts?${q.toString()}`);
}

export async function getLatestDraftReceipt(): Promise<Receipt | null> {
  const res = await fetchAPI<{ receipt: Receipt | null }>(
    '/receipts/latest-draft',
  );
  return res.receipt;
}

export function getReceipt(id: number): Promise<Receipt> {
  return fetchAPI(`/receipts/${id}`);
}

export function createReceipt(dto: { customer_name?: string | null } = {}): Promise<Receipt> {
  return fetchAPI('/receipts', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateReceipt(
  id: number,
  dto: { customer_name?: string | null },
): Promise<Receipt> {
  return fetchAPI(`/receipts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function replaceReceiptItems(
  id: number,
  items: ReceiptItemInput[],
): Promise<Receipt> {
  return fetchAPI(`/receipts/${id}/items`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export function deleteReceiptItem(
  id: number,
  itemId: number,
): Promise<{ success: boolean }> {
  return fetchAPI(`/receipts/${id}/items/${itemId}`, { method: 'DELETE' });
}

export function finalizeReceipt(id: number): Promise<Receipt> {
  return fetchAPI(`/receipts/${id}/finalize`, { method: 'POST' });
}

export function duplicateReceipt(id: number): Promise<Receipt> {
  return fetchAPI(`/receipts/${id}/duplicate`, { method: 'POST' });
}

export function deleteReceipt(id: number): Promise<{ success: boolean }> {
  return fetchAPI(`/receipts/${id}`, { method: 'DELETE' });
}

export function listTrashedReceipts(params: {
  status?: ReceiptStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedReceipts> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return fetchAPI(`/receipts/trash?${q.toString()}`);
}

export function restoreReceipt(id: number): Promise<Receipt> {
  return fetchAPI(`/receipts/${id}/restore`, { method: 'PATCH' });
}

export function permanentDeleteReceipt(
  id: number,
): Promise<{ success: boolean }> {
  return fetchAPI(`/receipts/${id}/permanent`, { method: 'DELETE' });
}
