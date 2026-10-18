// Shared by the demo store and the server: how an update body merges into a record.

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Objects merge recursively, arrays and other values replace, `undefined` removes the key. */
export function deepMerge<T>(a: T, b: unknown): T {
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) }
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
    if (v === undefined) delete out[k]
    else if (isPlainObject(v) && isPlainObject(out[k])) out[k] = deepMerge(out[k], v)
    else out[k] = v
  }
  return out as T
}
