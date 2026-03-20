import Navbar from '../components/shared/Navbar'

export default function ReaderPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Receiver</h1>
          <p className="text-gray-400 text-[13px] mt-1">
            Scan JABCode frames to reconstruct the original file
          </p>
        </div>
        <div className="h-[400px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/30">
          <div className="text-3xl mb-3 opacity-40">📷</div>
          <p className="text-[13px] font-medium text-gray-400">Receiver coming soon</p>
        </div>
      </main>
    </div>
  )
}
