import { Link, Outlet, useLocation } from 'react-router-dom'
import { Mail } from 'lucide-react'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="aurora-bg min-h-full flex flex-col">
      <header className="w-full">
        <div className="relative mx-auto flex max-w-5xl items-center justify-center px-6 py-5">
          <Link to="/" className="group">
            <span className="font-serif text-lg tracking-wide text-ink-900 group-hover:text-brand transition-colors">
              Жизнь мечты
            </span>
          </Link>
          {!isHome && (
            <Link
              to="/"
              className="absolute right-6 top-1/2 -translate-y-1/2 text-sm text-ink-500 hover:text-ink-900 transition-colors"
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
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-8 text-center text-xs text-ink-400">
          <p>
            Сервис разработан компанией{' '}
            <a
              href="https://zurus.tech/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              ZURUS.TECH
            </a>
          </p>
          <a
            href="mailto:ceo@zurus.tech?subject=Отзыв о сервисе «Прояви жизнь своей мечты»"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-ink-600 shadow-soft transition-colors hover:border-brand/40 hover:text-brand"
          >
            <Mail className="h-3.5 w-3.5" />
            Отправить отзыв
          </a>
        </div>
      </footer>
    </div>
  )
}
