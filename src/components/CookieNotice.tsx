import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'cookie-consent'

export default function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // localStorage unavailable (private mode) — just show the notice
      setVisible(true)
    }
  }, [])

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 animate-fadeup">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-2xl glass p-5 text-center shadow-soft sm:flex-row sm:text-left">
        <p className="text-sm leading-relaxed text-ink-600">
          Мы используем файлы cookie и Яндекс.Метрику, чтобы понимать, как
          используется сайт. Продолжая пользоваться сайтом, вы соглашаетесь с{' '}
          <Link to="/privacy" className="text-brand hover:underline">
            политикой конфиденциальности
          </Link>
          .
        </p>
        <button onClick={accept} className="btn-primary shrink-0">
          Хорошо
        </button>
      </div>
    </div>
  )
}
