import { encodeHeader, decodeHeader, HEADER_SIZE } from './header'
import { getMimeFromId, getExtFromId } from './mime'
import { MODE } from './header'

// ─── Frame helpers ────────────────────────────────────────────────────────────
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

export function buildFrame({ mode, totalCodes, codeIndex, chunkBytes, mimeTypeId }) {
  const hdr   = encodeHeader({ mode, totalCodes, codeIndex, chunkLength: chunkBytes.length, mimeTypeId })
  const frame = new Uint8Array(HEADER_SIZE + chunkBytes.length)
  frame.set(hdr, 0)
  frame.set(chunkBytes, HEADER_SIZE)
  return MAGIC + b64enc(frame)
}

export function parseFrame(raw) {
  if (!raw?.startsWith(MAGIC)) return null

  let bytes
  try { bytes = b64dec(raw.slice(MAGIC.length)) } catch { return null }
  if (bytes.length < HEADER_SIZE) return null

  let hdr
  try { hdr = decodeHeader(bytes) } catch { return null }

  const payload = bytes.slice(HEADER_SIZE, HEADER_SIZE + hdr.chunkLength)
  return {
    ...hdr,
    payload,
    mime: getMimeFromId(hdr.mimeTypeId),
    ext:  getExtFromId(hdr.mimeTypeId),
  }
}

// ─── Writer — Web Worker based ────────────────────────────────────────────────
// Each worker has its own JS scope, so var declarations in jabcodeWriter.js
// never conflict across worker instances. We terminate and respawn the worker
// every REINIT_EVERY frames to prevent WASM heap accumulation.

const REINIT_EVERY = 20

let _currentWorker     = null
let _workerFrameCount  = 0
let _encCnt            = 0

function spawnWorker() {
  if (_currentWorker) _currentWorker.terminate()
  _currentWorker    = new Worker('/encoder.worker.js')
  _workerFrameCount = 0
}

export function resetFrameCount() {
  _workerFrameCount = 0
}

// loadWriter — kept for API compatibility, spawns the first worker
export function loadWriter() {
  spawnWorker()
  // Return a promise that resolves immediately — the worker initialises
  // lazily on first message
  return Promise.resolve()
}

export function encodeFrame(frameStr, opts = {}) {
  // Spawn a fresh worker every REINIT_EVERY frames
  if (!_currentWorker || _workerFrameCount >= REINIT_EVERY) {
    spawnWorker()
  }

  _encCnt++
  _workerFrameCount++

  const id = _encCnt

  return new Promise((resolve, reject) => {
    const worker = _currentWorker

    const cleanup = () => {
      worker.onmessage = null
      worker.onerror   = null
    }

    worker.onmessage = (e) => {
      if (e.data.id !== id) return
      cleanup()
      if (e.data.success) {
        resolve(new Uint8Array(e.data.png))
      } else {
        reject(new Error(e.data.error ?? 'Unknown encoder error'))
      }
    }

    worker.onerror = (e) => {
      cleanup()
      reject(new Error(e.message ?? 'Worker error'))
    }

    worker.postMessage({ frameStr, opts, id })
  })
}

// ─── Reader ───────────────────────────────────────────────────────────────────
let _readerReady = false
let _output      = ''
let _decCnt      = 0

export function loadReader() {
  if (_readerReady) return Promise.resolve()

  if (document.querySelector('script[src="/assets/jabcodeReader.js"]')) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.callMain && window.FS) {
          clearInterval(check)
          _readerReady = true
          resolve()
        }
      }, 50)
    })
  }

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

  try { window.callMain([name]) } catch (_) { /* decode miss — normal */ }

  window.FS.unlink(name)

  const lines = _output.trim().split('\n').filter(Boolean)
  return lines.at(-1) ?? ''
}
