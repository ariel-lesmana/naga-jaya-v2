const MAX_BYTES = 100_000;

export function truncateBody(value: unknown): unknown {
  if (value == null) return null;

  if (
    Buffer.isBuffer(value) ||
    value instanceof Uint8Array ||
    (typeof value === 'object' && value !== null && 'pipe' in (value as object))
  ) {
    return { _binary: true };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { _unserializable: true };
  }

  if (!serialized) return null;

  const size = Buffer.byteLength(serialized, 'utf8');
  if (size <= MAX_BYTES) {
    return value;
  }

  return {
    _truncated: true,
    size,
    preview: serialized.slice(0, 500),
  };
}
