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
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

export function getProducts(params: {
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
  return fetchAPI(`/products?${query.toString()}`);
}

export function getProduct(id: number): Promise<ProductResponse> {
  return fetchAPI(`/products/${id}`);
}

export function createProduct(dto: CreateProductDto): Promise<ProductResponse> {
  return fetchAPI('/products', {
    method: 'POST',
    body: JSON.stringify(dto),
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
