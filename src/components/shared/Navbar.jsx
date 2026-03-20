import { Link, useLocation } from 'react-router-dom'

function Logo() {
  const cols = [
    '#EF4444','#3B82F6','#22C55E','#EAB308',
    '#06B6D4','#A855F7','#F97316','#EC4899',
    '#3B82F6','#22C55E','#EF4444','#06B6D4',
    '#EAB308','#EC4899','#A855F7','#F97316',
  ]
  return (
    <div className="grid grid-cols-4 gap-[2px] w-[20px] h-[20px] flex-shrink-0">
      {cols.map((c, i) => (
        <div key={i} style={{ backgroundColor: c }} className="rounded-[1px]" />
      ))}
    </div>
  )
}

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/writer" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-gray-900" style={{ fontFamily: 'var(--font-sans)' }}>
            ChromaFlow
          </span>
        </Link>

        <nav className="flex items-center">
          <div className="flex bg-gray-100 rounded-lg p-[3px] gap-[2px]">
            {[{ path: 'writer', label: 'Sender' }, { path: 'reader', label: 'Receiver' }].map(({ path, label }) => (
              <Link
                key={path}
                to={`/${path}`}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ${
                  pathname === `/${path}`
                    ? 'bg-white text-gray-900 shadow-sm shadow-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}
