import { useEffect, useRef, useState } from 'react'

export default function GifPlayer({ gifUrl, fps, frameCount, onClose }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  // Sync state with actual browser fullscreen status
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // ESC when not in native fullscreen closes the modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const enterFullscreen = async () => {
    try {
      await containerRef.current?.requestFullscreen()
    } catch (err) {
      console.warn('Fullscreen request failed:', err)
    }
  }

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch (err) {
      console.warn('Exit fullscreen failed:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">

      {/* Backdrop — clicking outside closes modal (only when not fullscreen) */}
      {!isFullscreen && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Modal / Fullscreen container */}
      <div
        ref={containerRef}
        className={`relative z-10 bg-white flex flex-col transition-all duration-200 ${
          isFullscreen
            ? 'w-screen h-screen rounded-none'
            : 'w-full max-w-2xl mx-4 rounded-2xl shadow-2xl shadow-black/20 max-h-[90vh]'
        }`}
      >

        {/* Header — hidden when fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Animated GIF</p>
              <p className="text-[11px] text-gray-400 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                {frameCount} frames · {fps} fps
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={enterFullscreen}
                title="Go fullscreen — point receiver camera at this screen"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
                  text-gray-600 border border-gray-200 rounded-lg
                  hover:border-gray-400 hover:text-gray-900 transition-all"
              >
                ⛶ Fullscreen
              </button>
              <a
                href={gifUrl}
                download="chromaflow.gif"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
                  text-gray-600 border border-gray-200 rounded-lg
                  hover:border-gray-400 hover:text-gray-900 transition-all"
              >
                ↓ Download
              </a>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg
                  text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* GIF image */}
        <div className={`flex items-center justify-center bg-white overflow-hidden ${
          isFullscreen ? 'flex-1 w-full h-full' : 'p-6'
        }`}>
          <img
            src={gifUrl}
            alt="ChromaFlow animated JABCode sequence"
            className={`block ${
              isFullscreen
                ? 'max-w-full max-h-full w-auto h-auto'
                : 'max-w-full max-h-[60vh] w-auto h-auto rounded-xl border border-gray-100'
            }`}
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Fullscreen overlay controls */}
        {isFullscreen && (
          <>
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <a
                href={gifUrl}
                download="chromaflow.gif"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
                  bg-white/90 backdrop-blur-sm text-gray-700 border border-gray-200
                  rounded-lg hover:bg-white transition-all shadow-sm"
              >
                ↓ Download
              </a>
              <button
                onClick={exitFullscreen}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
                  bg-white/90 backdrop-blur-sm text-gray-700 border border-gray-200
                  rounded-lg hover:bg-white transition-all shadow-sm"
              >
                ✕ Exit fullscreen
              </button>
            </div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
              <p className="text-[11px] text-gray-500 bg-white/80 backdrop-blur-sm
                px-3 py-1.5 rounded-full border border-gray-100 whitespace-nowrap">
                Point the receiver's camera at this screen to scan
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
