import { useEffect, useRef, useState } from 'react'

const FPS_OPTIONS = [1, 2, 5, 10, 15, 20, 25, 30, 45, 60, 75, 90]

export default function FramePlayer({ rawPngs = [], fps, setFps }) {
  const [frameUrls, setFrameUrls] = useState([])
  const [index, setIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const containerRef = useRef(null)
  const intervalRef = useRef(null)

  const total = frameUrls.length

  // Convert PNG bytes → Blob URLs (once)
  useEffect(() => {
    if (!rawPngs.length) return

    const urls = rawPngs.map(png =>
      URL.createObjectURL(new Blob([png], { type: 'image/png' }))
    )

    // GROUP INTO PAIRS
    const paired = []
    for (let i = 0; i < urls.length; i += 2) {
      paired.push({
        left: urls[i],
        right: urls[i + 1] || null
      })
    }

    setFrameUrls(paired)

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [rawPngs])

  // Playback loop
  useEffect(() => {
    if (total <= 1) return

    clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % total)
    }, 1000 / fps)

    return () => clearInterval(intervalRef.current)
  }, [fps, total])

  // Sync fullscreen state (ESC support)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Fullscreen handler
  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  if (!frameUrls.length) return null

  return (
    <div
      ref={containerRef}
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center'
          : 'relative w-full rounded-xl border border-gray-200 bg-white p-4'
      }`}
    >
      {/* Image + Fullscreen button */}
      <div
        className={`relative flex items-center justify-center ${
            isFullscreen ? 'h-[calc(100vh-80px)] px-4' : 'h-[260px]'
        }`}
      >
        {/* Fullscreen Button (anchored to image) */}
        <button
            onClick={toggleFullscreen}
            className={`absolute top-2 right-2 z-20 text-xs px-2 py-1 rounded-md border shadow-sm backdrop-blur-sm 
                ${
                isFullscreen
                    ? 'sm:hidden !border-white !text-white bg-black/60 hover:bg-black/80'
                    : 'border-gray-300 text-gray-700 bg-white/90 hover:bg-gray-100'
                }
            `}
            >
            {isFullscreen ? 'Exit' : 'Fullscreen'}
        </button>

        <div className="flex items-center justify-center gap-2 w-full h-full">
          <img
            src={frameUrls[index]?.left}
            alt="left"
            className="max-h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />

          {frameUrls[index]?.right && (
            <img
              src={frameUrls[index].right}
              alt="right"
              className="max-h-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full max-w-2xl mt-3 ${
            isFullscreen ? 'px-4' : ''
        }`}>
        {/* Frame counter */}
        <div
          className="text-sm font-medium w-[130px] whitespace-nowrap tabular-nums"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Frame {index + 1} / {total}
        </div>

        {/* FPS slider */}
        <div className="flex items-center gap-3 w-full">
          <span className={`text-xs ml-7 ${isFullscreen ? 'text-gray-300' : 'text-gray-500'}`}>
            FPS
          </span>

          <input
            type="range"
            className="flex-1"
            min={0}
            max={FPS_OPTIONS.length - 1}
            step={1}
            value={FPS_OPTIONS.indexOf(fps)}
            onChange={e => setFps(FPS_OPTIONS[e.target.value])}
          />

          <span className="text-sm font-semibold w-10 text-right">
            {fps}
          </span>
        </div>
      </div>
    </div>
  )
}