/**
 * Страница заказа — точка выдачи и восстановления.
 *
 * Сюда пользователь попадает сразу после оплаты (в будущем — редиректом
 * из ЮKassa) и сюда же ведёт ссылка из письма. Запись создаётся заново
 * из параметров заказа, поэтому «не успел скачать» лечится повторным заходом.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Download, Loader2, Mail, Pencil } from 'lucide-react'
import { formatDate, getOrder, isValidEmail, sendOrderLink, type Order } from '../lib/orders'
import { downloadMantra } from '../lib/deliver'
import { preloadMusic } from '../lib/audio'

type LoadState = 'loading' | 'ready' | 'notfound' | 'error'

export default function OrderPage() {
  const { token = '' } = useParams()
  const [load, setLoad] = useState<LoadState>('loading')
  const [order, setOrder] = useState<Order | null>(null)
  const [loadError, setLoadError] = useState('')

  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState('')

  // Доставка на почту
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailError, setEmailError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoad('loading')
    getOrder(token)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          setLoad('notfound')
          return
        }
        setOrder(found)
        setLoad('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить заказ.')
        setLoad('error')
      })
    preloadMusic()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleDownload() {
    if (!order?.params || rendering) return
    setRendering(true)
    setError('')
    try {
      await downloadMantra(order.params)
    } catch (e) {
      console.error('[order] render failed', e)
      setError('Не удалось собрать запись. Попробуйте ещё раз.')
    } finally {
      setRendering(false)
    }
  }

  async function deliver(email?: string) {
    if (sending) return
    setSending(true)
    setEmailError('')
    try {
      const saved = await sendOrderLink(token, email)
      setOrder((prev) => (prev ? { ...prev, email: saved } : prev))
      setEditingEmail(false)
      setSent(true)
      window.setTimeout(() => setSent(false), 4000)
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Не удалось отправить письмо.')
    } finally {
      setSending(false)
    }
  }

  function saveEmail() {
    const value = emailDraft.trim()
    if (!isValidEmail(value)) {
      setEmailError('Проверьте адрес — кажется, в нём опечатка.')
      return
    }
    deliver(value)
  }

  if (load === 'loading') {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center text-ink-500">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (load === 'error') {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-ink-900">Не удалось открыть заказ</h1>
        <p className="mt-3 text-ink-500 leading-relaxed">{loadError}</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-7">
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  if (load === 'notfound' || !order) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-ink-900">Заказ не найден</h1>
        <p className="mt-3 text-ink-500 leading-relaxed">
          Проверьте ссылку из письма — возможно, она скопировалась не полностью.
        </p>
        <Link to="/" className="btn-primary mt-7">
          На главную
        </Link>
      </div>
    )
  }

  if (order.status !== 'paid') {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-ink-900">Заказ ожидает оплаты</h1>
        <p className="mt-3 text-ink-500 leading-relaxed">
          Как только платёж подтвердится, запись станет доступна на этой странице.
          Обновите её через минуту.
        </p>
      </div>
    )
  }

  if (order.expired || !order.params) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-ink-900">Ссылка больше не активна</h1>
        <p className="mt-3 text-ink-500 leading-relaxed">
          Ссылка на заказ действовала до {formatDate(order.expiresAt)}. Срок истёк,
          и текст вашей истории удалён — так мы не храним личные записи дольше
          необходимого.
        </p>
        <Link to="/compose" className="btn-primary mt-7">
          Создать новую запись
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-10 text-center">
      <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-white shadow-soft border border-black/5">
        <Check className="h-6 w-6 text-brand" />
      </span>
      <h1 className="mt-5 font-serif text-4xl text-ink-900">Ваша запись готова</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-600 leading-relaxed">
        Полная версия с вашим голосом и альфа-волнами. Скачайте её и слушайте
        каждый вечер в течение 30 дней.
      </p>

      {/* Скачивание */}
      <div className="mt-10 rounded-3xl glass p-8">
        <button onClick={handleDownload} disabled={rendering} className="btn-primary">
          {rendering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {rendering ? 'Собираем запись…' : 'Скачать запись (MP3)'}
        </button>
        <p className="mx-auto mt-3 max-w-sm text-xs text-ink-400 leading-relaxed">
          Скачивать можно сколько угодно раз — возвращайтесь на эту страницу по
          ссылке из письма.
        </p>
        {error && (
          <p className="mx-auto mt-4 max-w-sm rounded-xl border border-[#e7b3c2] bg-[#fceef2] p-3 text-sm text-[#c0507a]">
            {error}
          </p>
        )}
      </div>

      {/* Доставка на почту */}
      <div className="mt-6 rounded-3xl glass p-6 text-left">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <div className="flex-1">
            {editingEmail ? (
              <div className="space-y-3">
                <label className="block text-sm text-ink-600">
                  Новый адрес для ссылки
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-ink-900 outline-none focus:border-brand/50"
                  />
                </label>
                {emailError && <p className="text-xs text-[#c0507a]">{emailError}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={saveEmail} disabled={sending} className="btn-primary">
                    {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Сохранить и отправить
                  </button>
                  <button
                    onClick={() => {
                      setEditingEmail(false)
                      setEmailError('')
                    }}
                    className="text-sm text-ink-500 hover:text-ink-900"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-600">
                  Ссылка отправлена на{' '}
                  <span className="text-ink-900">{order.email}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => deliver()}
                    disabled={sending}
                    className="text-sm text-brand hover:underline disabled:opacity-50"
                  >
                    {sending ? 'Отправляем…' : 'Отправить ещё раз'}
                  </button>
                  <button
                    onClick={() => {
                      setEmailDraft(order.email)
                      setEditingEmail(true)
                      setEmailError('')
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Указать другой адрес
                  </button>
                </div>
                {sent && (
                  <p className="mt-3 text-xs text-brand">
                    Письмо отправлено. Если его нет во «Входящих», проверьте «Спам».
                  </p>
                )}
                {emailError && (
                  <p className="mt-3 text-xs text-[#c0507a]">{emailError}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-ink-400">
        Ссылка активна до {formatDate(order.expiresAt)}
      </p>
    </div>
  )
}
