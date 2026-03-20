export function chunkBytes(bytes, size) {
  const out = []
  for (let i = 0; i < bytes.length; i += size) {
    out.push(bytes.slice(i, i + size))
  }
  if (out.length === 0) out.push(new Uint8Array(0))
  return out
}