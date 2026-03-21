import { useState, useEffect } from 'react'
import {
  getDisplayProfile,
  computeAdaptiveGrid,
  estimateCapacity,
  MIN_MODULE_SIZE,
} from '../../core/display'

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-300">{hint}</p>}
    </div>
  )
}

const inputCls = `
  w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-800 bg-white
  focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all
`

const disabledInputCls = `
  w-full border border-gray-100 rounded-lg px-3 py-2 text-[13px] text-gray-400 bg-gray-50
  cursor-not-allowed
`

const fmtBytes = (b) => {
  if (b < 1024)    return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export default function SettingsPanel({ settings, onChange }) {
  const [open, setOpen]         = useState(false)
  const [autoFit, setAutoFit]   = useState(true)
  const [profile, setProfile]   = useState(null)
  const [grid, setGrid]         = useState(null)   // { modulesX, modulesY, symbolW, symbolH, totalMods }
  const [capacity, setCapacity] = useState(null)   // estimated bytes per frame

  const set = (k, v) => onChange(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!autoFit) return

    const p = getDisplayProfile()
    setProfile(p)

    const g = computeAdaptiveGrid(p.Weff, p.Heff, MIN_MODULE_SIZE)
    setGrid(g)

    const cap = estimateCapacity(g.symbolW, g.symbolH, MIN_MODULE_SIZE, settings.colorNumber, settings.eccLevel)

    setCapacity(cap)

    onChange(prev => ({
        ...prev,
        moduleSize:   g.moduleSize,
        symbolWidth:  g.symbolW,
        symbolHeight: g.symbolH,
        eccLevel:     1,
        chunkSize:    cap,
        autoFit:      true,
    }))
  }, [autoFit, settings.colorNumber, open])

  const handleAutoToggle = (checked) => {
    setAutoFit(checked)
    if (!checked) {
      setProfile(null)
      setGrid(null)
      setCapacity(null)
      onChange(prev => ({
        ...prev,
        moduleSize:   12,
        symbolWidth:  0,
        symbolHeight: 0,
        eccLevel:     3,
        chunkSize:    800,
        autoFit:      false,
      }))
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-[13px] font-medium
          text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <span>Advanced settings</span>
        <span className={`text-gray-300 text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pt-4 pb-5 bg-gray-50/40 space-y-4">

          {/* ── Display adaptive ─────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">

            <div className="flex items-center justify-between px-4 py-3 bg-white">
              <div>
                <p className="text-[13px] font-semibold text-gray-700">
                  Adaptive display fill
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Pack maximum modules to fill the screen — maximises data per frame
                </p>
              </div>
              <button
                onClick={() => handleAutoToggle(!autoFit)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                  autoFit ? 'bg-gray-900' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm
                transition-transform duration-200 ${autoFit ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            {/* Live readout */}
            {autoFit && profile && grid && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  Computed profile
                </p>
                <div
                  className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  <div className="flex justify-between">
                    <span className="text-gray-400">Screen</span>
                    <span className="text-gray-700 font-medium">{profile.Wd} × {profile.Hd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DPR</span>
                    <span className="text-gray-700 font-medium">{profile.rho}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Weff</span>
                    <span className="text-gray-700 font-medium">{profile.Weff} px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Heff</span>
                    <span className="text-gray-700 font-medium">{profile.Heff} px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Module size</span>
                    <span className="text-emerald-600 font-semibold">{grid.moduleSize} px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Grid</span>
                    <span className="text-emerald-600 font-semibold">{grid.modulesX} × {grid.modulesY}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Symbol</span>
                    <span className="text-gray-700 font-medium">{grid.symbolW} × {grid.symbolH} px (square)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total modules</span>
                    <span className="text-gray-700 font-medium">{grid.totalMods.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between col-span-2 pt-1.5 border-t border-gray-200 mt-0.5">
                    <span className="text-gray-400">Est. capacity</span>
                    <span className="text-blue-600 font-semibold">{fmtBytes(capacity)} / frame</span>
                  </div>
                </div>

                {/* Comparison callout */}
                <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                  <p className="text-[11px] text-blue-600 leading-relaxed">
                    <span className="font-semibold">{grid.modulesX * grid.modulesY} modules</span> vs ~1,024 in fixed mode
                    {' '}— <span className="font-semibold">
                      {Math.round((grid.totalMods / 1024))}× more data per frame
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Other settings ───────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <Field label="Camera FPS" hint="Receiver camera frame rate">
            <select
                className={inputCls}
                value={[30, 60, 120].includes(settings.cameraFps) ? settings.cameraFps : 'custom'}
                onChange={(e) => {
                if (e.target.value === 'custom') {
                    set('cameraFps', 1)  // set to 1 to trigger custom input visibility
                } else {
                    set('cameraFps', +e.target.value)
                }
                }}
            >
                <option value={30}>30 fps — browser default</option>
                <option value={60}>60 fps — native app</option>
                <option value={120}>120 fps — flagship phone</option>
                <option value="custom">Custom...</option>
            </select>
            {![30, 60, 120].includes(settings.cameraFps) && (
                <input
                type="number"
                className={inputCls + ' mt-2'}
                min={1}
                max={240}
                placeholder="Enter fps..."
                value={settings.cameraFps}
                onChange={(e) => set('cameraFps', +e.target.value)}
                />
            )}
            </Field>

            <Field label="Color Depth" hint="More colours = more data per frame">
              <select
                className={inputCls}
                value={settings.colorNumber}
                onChange={(e) => set('colorNumber', +e.target.value)}
              >
                <option value={4}>4 colours (2 bits/module)</option>
                <option value={8}>8 colours (3 bits/module)</option>
              </select>
            </Field>

            <Field
              label="Module size (px)"
              hint={autoFit ? `Fixed at ${MIN_MODULE_SIZE}px in adaptive mode` : 'Larger = easier to scan'}
            >
              {autoFit ? (
                <div className={disabledInputCls}>{grid?.moduleSize ?? MIN_MODULE_SIZE} px (adaptive min)</div>
              ) : (
                <input
                  type="number"
                  className={inputCls}
                  min={4} max={32}
                  value={settings.moduleSize}
                  onChange={(e) => set('moduleSize', +e.target.value)}
                />
              )}
            </Field>

            <Field label="ECC level (1–10)" hint="Higher = more fault tolerant">
              <input
                type="number"
                className={inputCls}
                min={1} max={10}
                value={settings.eccLevel}
                onChange={(e) => set('eccLevel', +e.target.value)}
              />
            </Field>

            <Field
              label="Chunk size (bytes)"
              hint={autoFit ? 'Auto-set to match frame capacity' : 'Payload bytes per frame'}
            >
              {autoFit ? (
                <div className={disabledInputCls}>{Math.min(capacity ?? 800, 65535)} B (auto)</div>
              ) : (
                <input
                  type="number"
                  className={inputCls}
                  min={64} max={4096}
                  value={settings.chunkSize}
                  onChange={(e) => set('chunkSize', +e.target.value)}
                />
              )}
            </Field>

          </div>
        </div>
      )}
    </div>
  )
}
