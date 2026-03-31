export function writeUint16BE(arr, offset, value) {
  arr[offset]     = (value >>> 8) & 0xff
  arr[offset + 1] =  value        & 0xff
}

export function readUint16BE(arr, offset) {
  return ((arr[offset] << 8) | arr[offset + 1]) >>> 0
}

export function buildBinaryHeader(isInitial, totalCodes, codeIndex, payloadBytes, filename) {
  const filenameBytes = (isInitial && filename)
    ? new TextEncoder().encode(filename)
    : new Uint8Array(0)

  let header
  if (isInitial) {
    header = new Uint8Array(2 + filenameBytes.length + 4)
    header[0] = 0x01
    header[1] = filenameBytes.length
    header.set(filenameBytes, 2)
    writeUint16BE(header, 2 + filenameBytes.length,     codeIndex)
    writeUint16BE(header, 2 + filenameBytes.length + 2, totalCodes)
  } else {
    header = new Uint8Array(5)
    header[0] = 0x00
    writeUint16BE(header, 1, codeIndex)
    writeUint16BE(header, 3, totalCodes)
  }

  const frame = new Uint8Array(header.length + payloadBytes.length)
  frame.set(header, 0)
  frame.set(payloadBytes, header.length)
  return frame
}

export function parseBinaryHeader(bytes) {
  if (!bytes || bytes.length < 5) return null

  const isInitial = (bytes[0] & 0x01) === 1
  let index, total, payload, filename = null

  if (isInitial) {
    if (bytes.length < 6) return null
    const fnLen = bytes[1]
    if (bytes.length < 2 + fnLen + 4) return null

    if (fnLen > 0) {
      filename = new TextDecoder().decode(bytes.slice(2, 2 + fnLen))
    }
    index   = readUint16BE(bytes, 2 + fnLen)
    total   = readUint16BE(bytes, 2 + fnLen + 2)
    payload = bytes.slice(2 + fnLen + 4)
  } else {
    index   = readUint16BE(bytes, 1)
    total   = readUint16BE(bytes, 3)
    payload = bytes.slice(5)
  }

  if (total < 1 || index < 0 || index >= total) return null

  return { isInitial, filename, index, total, payload }
}