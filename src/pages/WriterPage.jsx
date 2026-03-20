import { useState, useEffect } from 'react'
import JSZip from 'jszip'
import Navbar from '../components/shared/Navbar'
import FileDropZone from '../components/Writer/FileDropZone'
import SettingsPanel from '../components/Writer/SettingsPanel'
import { loadWriter, encodeFrame, buildFrame } from '../core/jabcode'
import { chunkBytes } from '../core/chunker'
import { getIdFromFilename } from '../core/mime'
import { MODE } from '../core/header'

const DEFAULTS = {
  cameraFps:   30,
  colorNumber: 8,
  moduleSize:  12,
  eccLevel:    3,
  chunkSize:   800,
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
  const [inputMode, setInputMode]   = useState('text')
  const [text, setText]             = useState('')
  const [file, setFile]             = useState(null)
  const [settings, setSettings]     = useState(DEFAULTS)
  const [wasmReady, setWasmReady]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress]     = useState({ cur: 0, total: 0 })
  const [codes, setCodes]           = useState([])
  const [rawPngs, setRawPngs]       = useState([])
  const [error, setError]           = useState('')

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

    for (let i = 0; i < total; i++) {
      setProgress({ cur: i + 1, total })
      await new Promise(r => setTimeout(r, 0))

      const str = buildFrame({
        mode:       frameMode,
        totalCodes: total,
        codeIndex:  i,
        chunkBytes: chunks[i],
        mimeTypeId: mimeId,
      })

      let png
      try {
        png = encodeFrame(str, {
          colorNumber: settings.colorNumber,
          moduleSize:  settings.moduleSize,
          eccLevel:    settings.eccLevel,
        })
      } catch (e) {
        setError(`Frame ${i + 1} failed: ${e.message}. Try reducing the chunk size.`)
        setGenerating(false)
        return
      }

      const url = URL.createObjectURL(new Blob([png], { type: 'image/png' }))
      results.push({ url, index: i, total, chunkLen: chunks[i].length })
      pngs.push(png)
    }

    setCodes(results)
    setRawPngs(pngs)
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
                  <span className="absolute bottom-3 right-3 text-[11px] text-gray-300" style={{ fontFamily: 'var(--font-mono)' }}>
                    {text.length}
                  </span>
                )}
              </div>
            ) : (
              <FileDropZone onFile={setFile} file={file} />
            )}

            <SettingsPanel settings={settings} onChange={setSettings} />

            <div className="flex items-center gap-2 text-[12px] text-gray-400 bg-gray-50 rounded-lg px-3.5 py-2.5 border border-gray-100">
              <span>🎞</span>
              <span>
                GIF at{' '}
                <span className="text-gray-700 font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                  {animFps} fps
                </span>
                {' '}({settings.cameraFps} fps camera, halved for reliability)
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3">
                <span className="mt-px">⚠</span>
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
                  <span className="text-[13px] font-medium text-gray-700" style={{ fontFamily: 'var(--font-mono)' }}>
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
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/30">
                <div className="text-3xl mb-3 opacity-40">🎨</div>
                <p className="text-[13px] font-medium text-gray-400">Nothing generated yet</p>
                <p className="text-[12px] text-gray-300 mt-1">Configure your input and hit generate</p>
              </div>
            )}

            {codes.length > 0 && (
              <div className="space-y-5">

                <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  <Stat label="Frames" value={codes.length} />
                  <Stat label="Speed" value={`${animFps} fps`} />
                  <Stat label="Per frame" value={`${settings.chunkSize}B`} />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-gray-400">
                    <span className="font-medium text-gray-800">{codes.length}</span> JABCode frames generated
                  </p>
                  <button
                    onClick={downloadZip}
                    className="text-[12px] font-medium px-3.5 py-2 border border-gray-200
                      rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-900
                      transition-all flex items-center gap-1.5"
                  >
                    ↓ Download all as ZIP
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {codes.map((c) => (
                    <div
                      key={c.index}
                      className="rounded-xl border border-gray-100 overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all duration-150"
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
