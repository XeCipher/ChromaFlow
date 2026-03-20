import { encodeHeader, decodeHeader, HEADER_SIZE } from './header'
import { getMimeFromId, getExtFromId } from './mime'

let _writerReady = false
let _readerReady = false
let _output      = ''
let _encCnt      = 0
let _decCnt      = 0

// We prefix every frame with "CF1:" then base64 the rest.
// base64 sidesteps null-byte issues when passing binary through jabcode's --input.
const MAGIC = 'CF1:'

const b64enc = (bytes) => {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

const b64dec = (str) => {
  const s   = atob(str)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

// Build the string that goes into jabcodeWriter --input
export function buildFrame({ mode, totalCodes, codeIndex, chunkBytes, mimeTypeId }) {
  const hdr   = encodeHeader({ mode, totalCodes, codeIndex, chunkLength: chunkBytes.length, mimeTypeId })
  const frame = new Uint8Array(HEADER_SIZE + chunkBytes.length)
  frame.set(hdr, 0)
  frame.set(chunkBytes, HEADER_SIZE)
  return MAGIC + b64enc(frame)
}

// Parse the string that comes out of jabcodeReader
export function parseFrame(raw) {
  if (!raw?.startsWith(MAGIC)) return null

  let bytes
  try { bytes = b64dec(raw.slice(MAGIC.length)) } catch { return null }
  if (bytes.length < HEADER_SIZE) return null

  let hdr
  try { hdr = decodeHeader(bytes) } catch { return null }

  const payload = bytes.slice(HEADER_SIZE, HEADER_SIZE + hdr.chunkLength)
  return { ...hdr, payload, mime: getMimeFromId(hdr.mimeTypeId), ext: getExtFromId(hdr.mimeTypeId) }
}

// Writer

export function loadWriter() {
  if (_writerReady) return Promise.resolve()

  return new Promise((resolve, reject) => {
    window.Module = {
      print:    (t) => console.log('[writer]', t),
      printErr: (t) => console.warn('[writer err]', t),
      onRuntimeInitialized() { _writerReady = true; resolve() },
    }
    const s   = document.createElement('script')
    s.src     = '/assets/jabcodeWriter.js'
    s.onerror = () => reject(new Error('Failed to load jabcodeWriter.js'))
    document.head.appendChild(s)
  })
}

export function encodeFrame(frameStr, opts = {}) {
  if (!_writerReady) throw new Error('Writer not ready')

  _encCnt++
  const out  = `_w${_encCnt}.png`
  const args = ['--input', frameStr, '--output', out]

  if (opts.colorNumber) args.push('--color-number', String(opts.colorNumber))
  if (opts.moduleSize)  args.push('--module-size',  String(opts.moduleSize))
  if ((opts.symbolWidth  ?? 0) > 0) args.push('--symbol-width',  String(opts.symbolWidth))
  if ((opts.symbolHeight ?? 0) > 0) args.push('--symbol-height', String(opts.symbolHeight))
  if (opts.eccLevel)    args.push('--ecc-level',    String(opts.eccLevel))

  window.callMain(args)

  const png = window.FS.readFile(out)
  window.FS.unlink(out)
  return png
}

// Reader

export function loadReader() {
  if (_readerReady) return Promise.resolve()

  return new Promise((resolve, reject) => {
    window.Module = {
      print(t) { _output += (_output ? '\n' : '') + t },
      printErr: (t) => console.warn('[reader err]', t),
      onRuntimeInitialized() { _readerReady = true; resolve() },
    }
    const s   = document.createElement('script')
    s.src     = '/assets/jabcodeReader.js'
    s.onerror = () => reject(new Error('Failed to load jabcodeReader.js'))
    document.head.appendChild(s)
  })
}

export function decodeImage(pngData) {
  if (!_readerReady) throw new Error('Reader not ready')

  _decCnt++
  const name = `_r${_decCnt}.png`
  window.FS.writeFile(name, pngData)
  _output = ''

  try { window.callMain([name]) } catch (_) { /* miss — no code in frame */ }

  window.FS.unlink(name)

  const lines = _output.trim().split('\n').filter(Boolean)
  return lines.at(-1) ?? ''
}