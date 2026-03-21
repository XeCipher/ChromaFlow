import { encodeHeader, decodeHeader, HEADER_SIZE } from './header'
import { getMimeFromId, getExtFromId } from './mime'

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
// Each worker has its own JS scope — no variable conflicts across instances.
// We terminate and respawn every REINIT_EVERY frames to prevent WASM heap
// accumulation. The new worker signals 'ready' once WASM is initialized,
// so we never post a frame before the worker is ready.

let _currentWorker    = null
let _workerFrameCount = 0
let _encCnt           = 0

// Spawn a fresh worker and wait for it to signal WASM is ready
function spawnWorker() {
  if (_currentWorker) _currentWorker.terminate()
  _currentWorker    = null
  _workerFrameCount = 0

  return new Promise((resolve, reject) => {
    const worker = new Worker('/encoder.worker.js')

    // Wait for the 'ready' signal before resolving
    const onMessage = (e) => {
      if (e.data.type === 'ready') {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        _currentWorker = worker
        resolve()
      }
    }

    const onError = (e) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(new Error('Worker failed to initialize: ' + e.message))
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
  })
}

export async function loadWriter() {
  await spawnWorker()
}

export function resetFrameCount() {
  _workerFrameCount = 0
}

export async function encodeFrame(frameStr, opts = {}) {
  // Dynamically compute reinit threshold based on chunk size.
  // Larger chunks stress the WASM heap more — reinit more frequently.
  // Empirically: safe budget is roughly 16KB of total encoded data per worker.
  const chunkSize   = opts.chunkSize ?? 800
  const reinitEvery = Math.max(3, Math.floor(16000 / chunkSize))

  if (!_currentWorker || _workerFrameCount >= reinitEvery) {
    await spawnWorker()
  }

  _encCnt++
  _workerFrameCount++

  const id = _encCnt

  return new Promise((resolve, reject) => {
    const worker = _currentWorker

    const onMessage = (e) => {
      if (e.data.type !== 'result' || e.data.id !== id) return
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (e.data.success) {
        resolve(new Uint8Array(e.data.png))
      } else {
        reject(new Error(e.data.error ?? 'Unknown encoder error'))
      }
    }

    const onError = (e) => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      reject(new Error(e.message ?? 'Worker error'))
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)

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
