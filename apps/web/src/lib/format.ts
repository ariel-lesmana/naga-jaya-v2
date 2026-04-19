export function formatIDR(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return 'Rp ' + value.toLocaleString('id-ID');
}

export function formatPct(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `${value}%`;
}

export function marginColor(pct: number | null | undefined): string {
  if (pct == null) return 'none';
  if (pct >= 20) return 'green';
  if (pct >= 10) return 'amber';
  return 'red';
}
