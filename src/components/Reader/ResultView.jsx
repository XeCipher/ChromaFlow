const fmtSize = (b) => {
  if (b < 1024)    return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export default function ResultView({ result }) {
  if (!result) return null
  const { type, text, blob, filename, size } = result

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div>
          <p className="text-[13px] font-semibold text-gray-800">File reconstructed</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Transfer complete</p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          Success
        </div>
      </div>

      <div className="p-5">
        {type === 'text' ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              Decoded text
            </p>
            <pre className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5
              text-[12px] text-gray-700 whitespace-pre-wrap break-all leading-relaxed
              max-h-64 overflow-y-auto" style={{ fontFamily: 'var(--font-mono)' }}>
              {text}
            </pre>
          </div>
        ) : (
          <div className="flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-100">
            <div className="text-3xl">📦</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 truncate">{filename}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{fmtSize(size)}</p>
            </div>
            <a
              href={URL.createObjectURL(blob)}
              download={filename}
              className="flex-shrink-0 px-4 py-2 bg-gray-900 hover:bg-gray-700
                text-white text-[12px] font-semibold rounded-lg transition-colors"
            >
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
