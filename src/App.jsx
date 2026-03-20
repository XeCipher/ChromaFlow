import { Routes, Route, Navigate } from 'react-router-dom'
import WriterPage from './pages/WriterPage'
import ReaderPage from './pages/ReaderPage'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      <Routes>
        <Route path="/" element={<Navigate to="/writer" replace />} />
        <Route path="/writer" element={<WriterPage />} />
        <Route path="/reader" element={<ReaderPage />} />
      </Routes>
    </div>
  )
}