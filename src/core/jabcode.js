import { buildBinaryHeader, parseBinaryHeader } from './header'

// Frame helpers
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

export function buildFrame(isInitial, totalCodes, codeIndex, payloadBytes, filename) {
  const binaryFrame = buildBinaryHeader(isInitial, totalCodes, codeIndex, payloadBytes, filename)
  return MAGIC + b64enc(binaryFrame)
}

export function parseFrame(raw) {
  if (!raw?.startsWith(MAGIC)) return null

  let bytes
  try { bytes = b64dec(raw.slice(MAGIC.length)) } catch { return null }
  
  return parseBinaryHeader(bytes)
}

// Writer — Web Worker based
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

// Reader — Web Worker based
let _readerWorker = null
let _readerFrameCount = 0
let _decCnt = 0
let _readerOutput = ''

function spawnReaderWorker() {
  if (_readerWorker) _readerWorker.terminate()
  _readerOutput = ''
  _readerFrameCount = 0
  
  return new Promise((resolve) => {
    const worker = new Worker('/decoder.worker.js')
    worker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        _readerWorker = worker
        resolve()
      } else if (e.data.type === 'stdout') {
        _readerOutput += ( _readerOutput ? '\n' : '') + e.data.text
      }
    }
  })
}

export async function loadReader() {
  await spawnReaderWorker()
}

export async function decodeImage(pngData) {
  // Respawn worker every 20 frames to clear WASM memory
  if (!_readerWorker || _readerFrameCount >= 20) {
    await spawnReaderWorker()
  }

  _decCnt++
  _readerFrameCount++
  _readerOutput = ''
  const id = _decCnt

  return new Promise((resolve) => {
    const onMessage = (e) => {
      if (e.data.type !== 'done' || e.data.id !== id) return
      _readerWorker.removeEventListener('message', onMessage)
      
      const lines = _readerOutput.trim().split('\n').filter(Boolean)
      resolve(lines.at(-1) ?? '')
    }
    _readerWorker.addEventListener('message', onMessage)
    _readerWorker.postMessage({ pngData, id }, [pngData.buffer])
  })
}