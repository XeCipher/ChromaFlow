import { useRef } from 'react'

export default function FileDropZone({ onFiles, files }) {
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) {
      onFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleChange = (e) => {
    if (e.target.files?.length) {
      onFiles(Array.from(e.target.files))
    }
  }

  return (
    <div>
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-3xl mb-2 opacity-60">📁</div>
        <p className="text-[13px] font-medium text-gray-600">
          Click to choose files, or drag & drop
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {files && files.length > 0 && (
        <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-3">
          <p className="text-[12px] font-semibold text-gray-700 mb-1">
            {files.length} file{files.length > 1 ? 's' : ''} selected
          </p>
          <ul className="text-[11px] text-gray-500 max-h-24 overflow-y-auto space-y-1" style={{ fontFamily: 'var(--font-mono)' }}>
            {files.map((f, i) => (
              <li key={i} className="truncate">{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}