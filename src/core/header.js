// 12-byte binary header — big-endian
//
// [0]     MODE (4b high) | RSVD (4b low)
// [1-2]   TOTAL_CODES (16b)
// [3]     padding
// [4-5]   CODE_INDEX (16b)
// [6-7]   CHUNK_LENGTH (16b)
// [8-9]   MIME_TYPE_ID (16b)
// [10-11] RESERVED (16b)

export const HEADER_SIZE = 12

export const MODE = {
  TEXT:   0x0,
  BINARY: 0x1,
  JSON:   0x2,
  URL:    0x3,
}

export function encodeHeader({ mode, totalCodes, codeIndex, chunkLength, mimeTypeId }) {
  const buf  = new Uint8Array(HEADER_SIZE)
  const view = new DataView(buf.buffer)

  buf[0] = (mode & 0xF) << 4
  view.setUint16(1, totalCodes,  false)
  buf[3] = 0x00
  view.setUint16(4, codeIndex,   false)
  view.setUint16(6, chunkLength, false)
  view.setUint16(8, mimeTypeId,  false)
  view.setUint16(10, 0x0000,     false)

  return buf
}

export function decodeHeader(buf) {
  if (buf.length < HEADER_SIZE) throw new Error('Buffer too short for header')
  const view = new DataView(buf.buffer, buf.byteOffset)

  return {
    mode:        (buf[0] >> 4) & 0xF,
    totalCodes:  view.getUint16(1,  false),
    codeIndex:   view.getUint16(4,  false),
    chunkLength: view.getUint16(6,  false),
    mimeTypeId:  view.getUint16(8,  false),
  }
}