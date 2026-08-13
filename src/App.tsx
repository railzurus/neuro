import { useEffect, useRef } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Mail } from 'lucide-react'
import CookieNotice from './components/CookieNotice'

const YM_COUNTER_ID = 111091612

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void
  }
}

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  // Track SPA route changes in Yandex.Metrika. The counter's `init` already
  // records the first pageview, so skip the initial render to avoid double-counting.
  const isFirstHit = useRef(true)
  useEffect(() => {
    if (isFirstHit.current) {
      isFirstHit.current = false
      return
    }
    window.ym?.(YM_COUNTER_ID, 'hit', location.pathname + location.search)
  }, [location.pathname, location.search])

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

      <footer className="w-full border-t border-black/[0.06]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 py-10 text-center text-xs text-ink-400">
          {/* Документы сервиса — собраны в одном месте (требование РКН) */}
          <nav aria-label="Документы сервиса" className="flex flex-col items-center gap-2">
            <span className="text-[0.7rem] uppercase tracking-wider text-ink-400/80">
              Документы
            </span>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <Link
                to="/privacy"
                className="text-ink-600 hover:text-brand transition-colors"
              >
                Политика обработки персональных данных
              </Link>
              <Link
                to="/terms"
                className="text-ink-600 hover:text-brand transition-colors"
              >
                Пользовательское соглашение
              </Link>
            </div>
          </nav>

          <a
            href="mailto:ceo@zurus.tech?subject=Отзыв о сервисе «Прояви жизнь своей мечты»"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-ink-600 shadow-soft transition-colors hover:border-brand/40 hover:text-brand"
          >
            <Mail className="h-3.5 w-3.5" />
            Отправить отзыв
          </a>

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
        </div>
      </footer>

      <CookieNotice />

      {/*
        Без этого переход по ссылке сохраняет позицию скролла с прошлой
        страницы, и пользователь попадает в середину новой. Уводит наверх на
        новых переходах и возвращает прежнее место при «назад»/«вперёд».
      */}
      <ScrollRestoration />
    </div>
  )
}
