import { Link, Outlet, useLocation } from 'react-router-dom'
import { Moon } from 'lucide-react'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="aurora-bg min-h-full flex flex-col">
      <header className="w-full">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-white shadow-soft border border-black/5 group-hover:border-brand/40 transition-colors">
              <Moon className="h-4 w-4 text-brand" />
            </span>
            <span className="font-serif text-lg tracking-wide text-ink-900">
              Жизнь мечты
            </span>
          </Link>
          {!isHome && (
            <Link
              to="/"
              className="text-sm text-ink-500 hover:text-ink-900 transition-colors"
            >
              На главную
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 w-full">
        <Outlet />
      </main>

      <footer className="w-full">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center text-xs text-ink-400">
          Сервис разработан компанией{' '}
          <a
            href="https://zurus.tech/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            ZURUS
          </a>
        </div>
      </footer>
    </div>
  )
}
