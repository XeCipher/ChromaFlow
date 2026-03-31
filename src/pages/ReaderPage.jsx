import { useState, useEffect, useRef, useCallback } from 'react'
import Navbar from '../components/shared/Navbar'
import SlotGrid from '../components/Reader/SlotGrid'
import ResultView from '../components/Reader/ResultView'
import { loadReader, decodeImage, parseFrame } from '../core/jabcode'

function fileToPng(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width  = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d').drawImage(img, 0, 0)
      c.toBlob(blob => {
        URL.revokeObjectURL(url)
        blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)))
      }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

function quickHash(imageData) {
  const d = imageData.data
  let h = 0
  for (let i = 0; i < d.length; i += 64) h ^= d[i] << (i % 24)
  return h
}

export default function ReaderPage() {
  const [wasmReady, setWasmReady]             = useState(false)
  const [wasmError, setWasmError]             = useState('')
  const [totalCodes, setTotalCodes]           = useState(null)
  const [received, setReceived]               = useState(new Map())
  const [sessionMode, setSessionMode]         = useState(null)
  const [sessionFilename, setSessionFilename] = useState(null)
  const [result, setResult]                   = useState(null)
  const [lastScan, setLastScan]               = useState(null)
  const [scanError, setScanError]             = useState('')
  const [cameraOn, setCameraOn]               = useState(false)
  const [cameraStatus, setCameraStatus]       = useState('')
  const [detectedFps, setDetectedFps]         = useState(null)

  const streamRef     = useRef(null)
  const videoRef      = useRef(null)
  const lastHashRef   = useRef(null)
  const scanFileInput = useRef(null)
  const totalRef      = useRef(null)
  const receivedRef   = useRef(new Map())
  const rafRef       = useRef(null)
  const lastScanTime = useRef(0)

  // Keep refs in sync
  useEffect(() => { totalRef.current = totalCodes }, [totalCodes])
  useEffect(() => { receivedRef.current = received }, [received])

  const receivedCount = received.size
  const pct = totalCodes ? Math.round((receivedCount / totalCodes) * 100) : 0
  const allDone = totalCodes !== null && receivedCount === totalCodes

  useEffect(() => {
    loadReader()
      .then(() => setWasmReady(true))
      .catch((e) => setWasmError('Decoder failed to load: ' + e.message))
    return () => stopCamera()
  }, [])

  const processRaw = useCallback((raw, imgUrl = null) => {
    setScanError('')
    const frame = parseFrame(raw)
    if (!frame) {
      if (imgUrl) setScanError('No ChromaFlow code found in this image.')
      return false
    }

    const { isInitial, filename, index, total, payload } = frame

    if (receivedRef.current.has(index)) return false

    setReceived(prev => {
      const next = new Map(prev)
      next.set(index, payload)
      return next
    })

    if (totalRef.current === null) {
      setTotalCodes(total)
      setSessionMode(filename ? 'binary' : 'text')
      if (filename) setSessionFilename(filename)
    } else if (isInitial && filename && sessionFilename === null) {
      // Catch filename if frame 0 arrives late
      setSessionMode('binary')
      setSessionFilename(filename)
    }

    if (imgUrl) {
      setLastScan({ imgUrl, index, total, chunkLen: payload.length })
    }

    return true
  }, [sessionFilename])

  const onFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setScanError('')

    const imgUrl  = URL.createObjectURL(file)
    let pngData
    try { pngData = await fileToPng(file) }
    catch { setScanError('Could not read image.'); return }

    const raw = decodeImage(pngData)
    processRaw(raw, imgUrl)
  }

  // Reassemble when all frames received
  useEffect(() => {
    if (!allDone || result) return

    let totalLen = 0
    for (const chunk of received.values()) totalLen += chunk.length

    const full = new Uint8Array(totalLen)
    let offset = 0
    for (let i = 0; i < totalCodes; i++) {
      full.set(received.get(i), offset)
      offset += received.get(i).length
    }

    if (sessionMode === 'text') {
      setResult({ type: 'text', text: new TextDecoder('utf-8').decode(full) })
    } else {
      const blob = new Blob([full], { type: 'application/octet-stream' })

      setResult({
        type: 'binary',
        blob,
        filename: sessionFilename || 'reconstructed_file.bin',
        size: full.length
      })
    }
  }, [allDone, result, received, totalCodes, sessionMode, sessionFilename])

  const startCamera = async () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    lastScanTime.current = 0

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current          = stream
      videoRef.current.srcObject = stream
      setCameraOn(true)
      setCameraStatus('Scanning...')

      const track      = stream.getVideoTracks()[0]
      const detectedFps = track.getSettings().frameRate
      if (detectedFps) setDetectedFps(Math.round(detectedFps))

      const targetInterval = 1000 / 30  // 30 FPS scanning

      const scanLoop = async (timestamp) => {
        const video = videoRef.current
        if (!video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(scanLoop)
          return
        }

        if (timestamp - lastScanTime.current < targetInterval) {
          rafRef.current = requestAnimationFrame(scanLoop)
          return
        }

        lastScanTime.current = timestamp

        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) {
          rafRef.current = requestAnimationFrame(scanLoop)
          return
        }

        const canvas  = document.createElement('canvas')
        canvas.width  = w
        canvas.height = h
        canvas.getContext('2d').drawImage(video, 0, 0, w, h)

        const hash = quickHash(canvas.getContext('2d').getImageData(0, 0, 8, 8))
        if (hash !== lastHashRef.current) {
          lastHashRef.current = hash

          const pngData = await new Promise(res => {
            canvas.toBlob(b => b.arrayBuffer().then(ab => res(new Uint8Array(ab))), 'image/png')
          })

          const raw = decodeImage(pngData)
          const ok  = processRaw(raw)

          setCameraStatus(ok
            ? `Got frame — ${receivedRef.current.size} / ${totalRef.current ?? '?'}`
            : 'Scanning...'
          )
        }

        rafRef.current = requestAnimationFrame(scanLoop)
      }

      rafRef.current = requestAnimationFrame(scanLoop)
    } catch (err) {
      setScanError('Camera access denied: ' + err.message)
    }
  }

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
    setCameraStatus('')
    lastHashRef.current = null
  }

  const reset = () => {
    stopCamera()
    setTotalCodes(null)
    setReceived(new Map())
    receivedRef.current = new Map()
    totalRef.current    = null
    setSessionMode(null)
    setSessionFilename(null)
    setResult(null)
    setLastScan(null)
    setScanError('')
    setDetectedFps(null)
  }

  const missing = totalCodes
    ? Array.from({ length: totalCodes }, (_, i) => i).filter(i => !received.has(i))
    : []

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Receiver</h1>
            <p className="text-gray-400 text-[13px] mt-1">
              Scan JABCode frames to reconstruct the original file
            </p>
          </div>
          {(totalCodes !== null || result) && (
            <button
              onClick={reset}
              className="flex-shrink-0 text-[12px] font-medium px-3.5 py-2 border border-gray-200
                rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-all"
            >
              ↺ Start over
            </button>
          )}
        </div>

        {wasmError && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3">
            <span>⚠</span><span>{wasmError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 lg:gap-12">

          {/* Controls */}
          <div className="space-y-4">

            {!wasmReady && !wasmError && (
              <div className="flex items-center gap-2.5 text-[13px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <span className="animate-spin text-base">⏳</span>
                Loading decoder...
              </div>
            )}

            <input
              ref={scanFileInput}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={onFileUpload}
            />

            <button
              onClick={() => scanFileInput.current?.click()}
              disabled={!wasmReady || allDone}
              className="w-full py-3 rounded-xl text-[13px] font-semibold border-[1.5px]
                border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50
                active:scale-[0.99] transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              📷 Upload a scanned image
            </button>

            <button
              onClick={() => cameraOn ? stopCamera() : startCamera()}
              disabled={!wasmReady || allDone}
              className={`w-full py-3 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.99]
                disabled:opacity-40 disabled:cursor-not-allowed
                ${cameraOn
                  ? 'bg-red-50 border-[1.5px] border-red-200 text-red-600 hover:bg-red-100'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
            >
              {cameraOn ? '⏹ Stop camera' : '🎥 Use live camera'}
            </button>

            <div className={`rounded-xl overflow-hidden border border-gray-100 relative bg-black transition-all ${cameraOn ? 'block' : 'hidden'}`}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full block" />
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2
                bg-black/60 text-white text-[11px] px-3 py-1.5 rounded-full backdrop-blur-sm whitespace-nowrap">
                {cameraStatus}
              </div>
            </div>

            {detectedFps && (
              <div className="flex items-center gap-2 text-[12px] bg-blue-50 border border-blue-100 text-blue-600 rounded-lg px-3.5 py-2.5">
                <span>📷</span>
                <span>
                  <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                    {detectedFps} fps
                  </span>
                  {' '}detected — set sender Camera FPS to {detectedFps}
                </span>
              </div>
            )}

            {scanError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3">
                <span className="mt-px flex-shrink-0">⚠</span>
                <span>{scanError}</span>
              </div>
            )}

            {lastScan && (
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Last scanned</p>
                </div>
                <div className="p-4 flex items-center gap-4">
                  <img
                    src={lastScan.imgUrl}
                    alt="last scan"
                    className="w-16 h-16 object-contain rounded-lg bg-white border border-gray-100"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="space-y-1 text-[12px]" style={{ fontFamily: 'var(--font-mono)' }}>
                    <p className="text-gray-800 font-medium">
                      Frame {lastScan.index + 1} of {lastScan.total}
                    </p>
                    <p className="text-gray-400">{lastScan.chunkLen} bytes</p>
                    <p className="text-emerald-500 font-medium">Stored</p>
                  </div>
                </div>
              </div>
            )}

            {!totalCodes && !result && (
              <div className="space-y-2.5 pt-2">
                {[
                  ['1', 'Open the Sender on another device'],
                  ['2', 'Generate a JABCode sequence from your file'],
                  ['3', 'Upload scanned images or use live camera here'],
                  ['4', 'Scan all frames — file reconstructs automatically'],
                ].map(([n, text]) => (
                  <div key={n} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center
                      text-[10px] font-bold text-gray-400 flex-shrink-0"
                      style={{ fontFamily: 'var(--font-mono)' }}>
                      {n}
                    </div>
                    <p className="text-[12px] text-gray-500">{text}</p>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Progress + result */}
          <div className="space-y-6">

            {totalCodes === null && !result && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center
                rounded-2xl border border-dashed border-gray-200 bg-gray-50/30">
                <div className="text-3xl mb-3 opacity-40">📡</div>
                <p className="text-[13px] font-medium text-gray-400">Waiting for scan</p>
                <p className="text-[12px] text-gray-300 mt-1">Upload or scan a JABCode frame to begin</p>
              </div>
            )}

            {totalCodes !== null && !result && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-gray-500">
                      <span className="font-semibold text-gray-800">{receivedCount}</span>
                      {' '}of{' '}
                      <span className="font-semibold text-gray-800">{totalCodes}</span>
                      {' '}frames received
                    </p>
                    <span className="text-[13px] font-medium text-gray-600" style={{ fontFamily: 'var(--font-mono)' }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-[3px] bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-400' : 'bg-gray-900'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Frame map</p>
                  <SlotGrid total={totalCodes} received={new Set(received.keys())} />
                </div>

                {missing.length > 0 && missing.length <= 20 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-widest mb-1.5">Still needed</p>
                    <p className="text-[12px] text-amber-700" style={{ fontFamily: 'var(--font-mono)' }}>
                      {missing.slice(0, 15).map(i => i + 1).join(', ')}
                      {missing.length > 15 ? ` ... +${missing.length - 15} more` : ''}
                    </p>
                  </div>
                )}

                {allDone && (
                  <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[13px] font-medium rounded-xl px-4 py-3">
                    <span>✅</span>
                    All {totalCodes} frames received — reconstructing file...
                  </div>
                )}
              </div>
            )}

            {result && <ResultView result={result} />}

          </div>

        </div>
      </main>
    </div>
  )
}