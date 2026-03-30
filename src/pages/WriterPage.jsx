import { useState, useEffect } from 'react'
import JSZip from 'jszip'
import GIF from 'gif.js'
import Navbar from '../components/shared/Navbar'
import FileDropZone from '../components/Writer/FileDropZone'
import SettingsPanel from '../components/Writer/SettingsPanel'
import FramePlayer from '../components/Writer/FramePlayer'
import { loadWriter, encodeFrame, buildFrame, resetFrameCount } from '../core/jabcode'
import { chunkBytes } from '../core/chunker'
import { getIdFromFilename } from '../core/mime'
import { MODE } from '../core/header'

const DEFAULTS = {
  cameraFps:    30,
  colorNumber:  8,
  moduleSize:   12,
  symbolWidth:  0,
  symbolHeight: 0,
  eccLevel:     3,
  chunkSize:    800,
  autoFit:      true,
}

function Stat({ label, value }) {
  return (
    <div className="text-center px-4 py-3">
      <p className="text-xl font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest font-medium">{label}</p>
    </div>
  )
}

export default function WriterPage() {
  const [inputMode, setInputMode]     = useState('text')
  const [text, setText]               = useState('')
  const [file, setFile]               = useState(null)
  const [settings, setSettings]       = useState(DEFAULTS)
  const [wasmReady, setWasmReady]     = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [progress, setProgress]       = useState({ cur: 0, total: 0 })
  const [codes, setCodes]             = useState([])
  const [rawPngs, setRawPngs]         = useState([])
  const [error, setError]             = useState('')
  const [gifBuilding, setGifBuilding] = useState(false)
  const [gifProgress, setGifProgress] = useState(0)
  const [playerFps, setPlayerFps] = useState(15)

  useEffect(() => {
    loadWriter()
      .then(() => setWasmReady(true))
      .catch((e) => setError('Encoder failed to load: ' + e.message))
  }, [])

  const animFps = Math.max(1, Math.floor(settings.cameraFps / 2))

  const generate = async () => {
    setError('')
    setCodes([])
    setRawPngs([])
    resetFrameCount()

    let payload, mimeId, frameMode

    if (inputMode === 'text') {
      if (!text.trim()) return setError('Enter some text first.')
      payload   = new TextEncoder().encode(text.trim())
      mimeId    = 0x0001
      frameMode = MODE.TEXT
    } else {
      if (!file) return setError('Pick a file first.')
      payload   = new Uint8Array(await file.arrayBuffer())
      mimeId    = getIdFromFilename(file.name)
      frameMode = MODE.BINARY
    }

    const chunks = chunkBytes(payload, settings.chunkSize)
    const total  = chunks.length

    setGenerating(true)
    setProgress({ cur: 0, total })

    const results = []
    const pngs    = []

    for (let i = 0; i < total; i += 2) {
      setProgress({ cur: i + 1, total })
      await new Promise(r => setTimeout(r, 0))

      // LEFT chunk
      let leftChunk = chunks[i]

      // RIGHT chunk (optional)
      let rightChunk = (i + 1 < total) ? chunks[i + 1] : null

      // Inject filename ONLY once (same as before)
      if (i === 0 && inputMode === 'file') {
        const encoder = new TextEncoder()
        const nameBytes = encoder.encode(file.name)
        const nameLen = new Uint8Array([nameBytes.length])

        const combined = new Uint8Array(1 + nameBytes.length + leftChunk.length)
        combined.set(nameLen, 0)
        combined.set(nameBytes, 1)
        combined.set(leftChunk, 1 + nameBytes.length)

        leftChunk = combined
      }

      // Build LEFT frame
      const leftStr = buildFrame({
        mode:       frameMode,
        totalCodes: total,
        codeIndex:  i,
        chunkBytes: leftChunk,
        mimeTypeId: mimeId,
      })

      // Build RIGHT frame (if exists)
      let rightStr = null
      if (rightChunk) {
        rightStr = buildFrame({
          mode:       frameMode,
          totalCodes: total,
          codeIndex:  i + 1,
          chunkBytes: rightChunk,
          mimeTypeId: mimeId,
        })
      }

      // Encode LEFT
      let leftPng
      try {
        leftPng = await encodeFrame(leftStr, {
          colorNumber:  settings.colorNumber,
          moduleSize:   settings.moduleSize,
          symbolWidth:  settings.symbolWidth ?? 0,
          symbolHeight: settings.symbolHeight ?? 0,
          eccLevel:     settings.eccLevel,
          chunkSize:    settings.chunkSize,
        })
      } catch (e) {
        setError(`Frame ${i + 1} failed: ${e.message}`)
        setGenerating(false)
        return
      }

      // Encode RIGHT (if exists)
      let rightPng = null
      if (rightStr) {
        try {
          rightPng = await encodeFrame(rightStr, {
            colorNumber:  settings.colorNumber,
            moduleSize:   settings.moduleSize,
            symbolWidth:  settings.symbolWidth ?? 0,
            symbolHeight: settings.symbolHeight ?? 0,
            eccLevel:     settings.eccLevel,
            chunkSize:    settings.chunkSize,
          })
        } catch (e) {
          setError(`Frame ${i + 2} failed: ${e.message}`)
          setGenerating(false)
          return
        }
      }

      // STORE BOTH (IMPORTANT CHANGE)
      const leftUrl = URL.createObjectURL(new Blob([leftPng], { type: 'image/png' }))

      if (rightPng) {
        const rightUrl = URL.createObjectURL(new Blob([rightPng], { type: 'image/png' }))

        results.push({
          left: leftUrl,
          right: rightUrl,
          index: i,
          total
        })

        pngs.push([leftPng, rightPng])
      } else {
        results.push({
          left: leftUrl,
          right: null,
          index: i,
          total
        })

        pngs.push([leftPng])
      }
    }

    setCodes(results)
    setRawPngs(pngs.flat())
    setGenerating(false)
  }

  const downloadZip = async () => {
    const zip = new JSZip()
    rawPngs.forEach((png, i) => {
      zip.file(`jabcode_${String(i).padStart(3, '0')}.png`, png)
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = 'chromaflow_codes.zip'
    a.click()
  }

  const buildGif = async () => {
    if (gifBuilding || rawPngs.length === 0) return

    setGifBuilding(true)
    setGifProgress(0)

    const bitmaps = await Promise.all(
      rawPngs.map(png => createImageBitmap(new Blob([png], { type: 'image/png' })))
    )

    const w = bitmaps[0].width
    const h = bitmaps[0].height

    const workerResp = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js')
    const workerText = await workerResp.text()
    const workerBlob = new Blob([workerText], { type: 'application/javascript' })
    const workerUrl  = URL.createObjectURL(workerBlob)

    const gif = new GIF({
      workers:      2,
      quality:      5,
      width:        w,
      height:       h,
      workerScript: workerUrl,
    })

    const canvas  = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx     = canvas.getContext('2d')
    const delay   = Math.round(1000 / playerFps)

    for (const bmp of bitmaps) {
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(bmp, 0, 0)
      gif.addFrame(canvas, { copy: true, delay })
    }

    gif.on('progress', (p) => setGifProgress(Math.round(p * 100)))
    gif.on('finished', (blob) => {
      URL.revokeObjectURL(workerUrl)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'chromaflow.gif'
      a.click()

      setGifBuilding(false)
      setGifProgress(0)
    })

    gif.render()
  }

  const pct = progress.total ? Math.round((progress.cur / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Sender</h1>
          <p className="text-gray-400 text-[13px] mt-1">
            Encode any file or text into an animated JABCode sequence
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 lg:gap-12">

          {/* Config */}
          <div className="space-y-4">

            <div className="flex bg-gray-100 rounded-xl p-[3px] gap-[2px]">
              {[['text', 'Text message'], ['file', 'File upload']].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setInputMode(m)}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                    inputMode === m
                      ? 'bg-white text-gray-900 shadow-sm shadow-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {inputMode === 'text' ? (
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={7}
                  placeholder="Type or paste your message..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-[13px]
                    text-gray-800 placeholder-gray-300 resize-none leading-relaxed
                    focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100
                    transition-all"
                />
                {text.length > 0 && (
                  <span className="absolute bottom-3 right-3 text-[11px] text-gray-300"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    {text.length}
                  </span>
                )}
              </div>
            ) : (
              <FileDropZone onFile={setFile} file={file} />
            )}

            <SettingsPanel settings={settings} onChange={setSettings} />

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3">
                <span className="mt-px flex-shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={generate}
              disabled={!wasmReady || generating}
              className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all
                bg-gray-900 hover:bg-gray-700 active:scale-[0.99] text-white
                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {!wasmReady
                ? 'Loading encoder...'
                : generating
                ? `Encoding frame ${progress.cur} of ${progress.total}...`
                : 'Generate JABCode Sequence →'}
            </button>

          </div>

          {/* Output */}
          <div>

            {generating && (
              <div className="mb-8 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-gray-400">Encoding frames</span>
                  <span className="text-[13px] font-medium text-gray-700"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    {pct}%
                  </span>
                </div>
                <div className="h-[2px] bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {!generating && codes.length === 0 && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center
                rounded-2xl border border-dashed border-gray-200 bg-gray-50/30">
                <div className="text-3xl mb-3 opacity-40">🎨</div>
                <p className="text-[13px] font-medium text-gray-400">Nothing generated yet</p>
                <p className="text-[12px] text-gray-300 mt-1">Configure your input and hit generate</p>
              </div>
            )}

            {codes.length > 0 && (
              <div className="space-y-5">

                <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  <Stat label="Frames" value={codes.length} />
                  <Stat label="Speed" value={`${playerFps} fps`} />
                  <Stat
                    label="Per frame"
                    value={settings.chunkSize >= 1024
                      ? `${(settings.chunkSize / 1024).toFixed(1)}KB`
                      : `${settings.chunkSize}B`}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={buildGif}
                    disabled={gifBuilding}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-700
                      text-white text-[13px] font-semibold rounded-xl transition-all
                      disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
                      active:scale-[0.99]"
                  >
                    {gifBuilding ? (
                      <>⏳ Building GIF... {gifProgress}%</>
                    ) : (
                      <>↓ Download GIF</>
                    )}
                  </button>

                  <button
                    onClick={downloadZip}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200
                      rounded-xl text-[13px] font-medium text-gray-600
                      hover:border-gray-400 hover:text-gray-900 transition-all"
                  >
                    ↓ Download ZIP
                  </button>
                </div>

                <FramePlayer rawPngs={rawPngs} fps={playerFps} setFps={setPlayerFps} />

                {gifBuilding && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Assembling GIF</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{gifProgress}%</span>
                    </div>
                    <div className="h-[2px] bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all duration-200"
                        style={{ width: `${gifProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {codes.map((c) => (
                    <div
                      key={c.index}
                      className="rounded-xl border border-gray-100 overflow-hidden
                        hover:border-gray-300 hover:shadow-sm transition-all duration-150"
                    >
                      <div className="bg-white p-3 sm:p-4">
                        <img
                          src={c.url}
                          alt={`Frame ${c.index + 1}`}
                          className="w-full h-auto block"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </div>
                      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[11px] text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>
                          {c.index + 1}/{c.total}
                        </span>
                        <a
                          href={c.url}
                          download={`jabcode_${String(c.index).padStart(3, '0')}.png`}
                          className="text-[11px] text-gray-300 hover:text-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↓
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  )
}