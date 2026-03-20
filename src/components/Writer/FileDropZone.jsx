import { useRef, useState } from 'react'

const fmtSize = (b) => {
  if (b < 1024)    return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export default function FileDropZone({ onFile, file }) {
  const [dragging, setDragging] = useState(false)
  const ref = useRef(null)

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      className={`
        relative rounded-xl border-[1.5px] border-dashed p-8
        text-center cursor-pointer select-none transition-all duration-200
        ${dragging
          ? 'border-blue-400 bg-blue-50'
          : file
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50/80 bg-gray-50/40'
        }
      `}
    >
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]) }}
      />

      {file ? (
        <div className="space-y-1.5">
          <div className="text-2xl">📄</div>
          <p className="text-[13px] font-semibold text-emerald-700 truncate px-4" style={{ fontFamily: 'var(--font-mono)' }}>
            {file.name}
          </p>
          <p className="text-xs text-emerald-500">{fmtSize(file.size)}</p>
          <p className="text-[11px] text-gray-400 pt-1">click to change</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-2xl">📂</div>
          <p className="text-[13px] font-medium text-gray-700">Drop a file here</p>
          <p className="text-xs text-gray-400">or click to browse — any format</p>
        </div>
      )}
    </div>
  )
}
