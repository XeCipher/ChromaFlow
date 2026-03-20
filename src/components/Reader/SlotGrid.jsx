export default function SlotGrid({ total, received }) {
  if (!total) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          title={`Frame ${i + 1}`}
          className={`
            w-7 h-7 rounded-md flex items-center justify-center
            text-[10px] font-semibold transition-all duration-200
            ${received.has(i)
              ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
              : 'bg-gray-100 text-gray-300 border border-gray-100'
            }
          `}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {i + 1}
        </div>
      ))}
    </div>
  )
}
