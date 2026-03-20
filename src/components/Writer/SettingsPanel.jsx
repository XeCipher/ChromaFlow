import { useState } from 'react'

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
  focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all
`

export default function SettingsPanel({ settings, onChange }) {
  const [open, setOpen] = useState(false)
  const set = (k, v) => onChange({ ...settings, [k]: v })

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-[13px] font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <span>Advanced settings</span>
        <span className={`text-gray-300 text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pt-4 pb-5 bg-gray-50/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Camera FPS" hint="Receiver camera frame rate">
            <select className={inputCls} value={settings.cameraFps} onChange={(e) => set('cameraFps', +e.target.value)}>
              <option value={30}>30 fps — browser default</option>
              <option value={60}>60 fps — native app</option>
              <option value={120}>120 fps — flagship phone</option>
            </select>
          </Field>

          <Field label="Color Depth" hint="More colours = more data per frame">
            <select className={inputCls} value={settings.colorNumber} onChange={(e) => set('colorNumber', +e.target.value)}>
              <option value={4}>4 colours (2 bits/module)</option>
              <option value={8}>8 colours (3 bits/module)</option>
            </select>
          </Field>

          <Field label="Module size (px)" hint="Larger = easier to scan">
            <input type="number" className={inputCls} min={4} max={32} value={settings.moduleSize} onChange={(e) => set('moduleSize', +e.target.value)} />
          </Field>

          <Field label="ECC level (1–10)" hint="Higher = more fault tolerant">
            <input type="number" className={inputCls} min={1} max={10} value={settings.eccLevel} onChange={(e) => set('eccLevel', +e.target.value)} />
          </Field>

          <Field label="Chunk size (bytes)" hint="Payload bytes per frame">
            <input type="number" className={inputCls} min={64} max={4096} value={settings.chunkSize} onChange={(e) => set('chunkSize', +e.target.value)} />
          </Field>
        </div>
      )}
    </div>
  )
}
