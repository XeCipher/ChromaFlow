import { useEffect, useState } from 'react'
import { loadWriter, encodeChunk } from '../core/jabcode'

export default function WriterPage() {
  const [status, setStatus] = useState('Loading WASM...')

  useEffect(() => {
    loadWriter()
      .then(() => {
        setStatus('Writer WASM loaded successfully!')
      })
      .catch((err) => {
        setStatus('Error: ' + err.message)
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          ChromaFlow Writer
        </h1>
        <p className="text-zinc-400">{status}</p>
      </div>
    </div>
  )
}