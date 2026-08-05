import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreditCard, Loader2, Pause, Play, RotateCcw, Headphones } from 'lucide-react'
import { useStore } from '../store/useStore'
import { wordCount } from '../lib/refine'
import { voiceById } from '../data/voices'
import { PaymentConsentNote } from '../components/Legal'
import { PRICE_RUB, createOrder, isValidEmail } from '../lib/orders'
import { MantraSession, loadVoices, preloadMusic, previewText } from '../lib/audio'

const WPM = 85

type PlayState = 'idle' | 'preparing' | 'playing' | 'paused' | 'done'

export default function Listen() {
  const finalText = useStore((s) => s.finalText)
  const voice = useStore((s) => s.voice)
  const speed = useStore((s) => s.speed)

  const navigate = useNavigate()
  const sessionRef = useRef<MantraSession | null>(null)
  const [state, setState] = useState<PlayState>('idle')
  const [progress, setProgress] = useState(0)
  const [ttsSupported, setTtsSupported] = useState(true)

  // Шаги покупки: выбор → ввод адреса → подтверждение адреса → оплата.
  const [step, setStep] = useState<'idle' | 'email' | 'confirm'>('idle')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  const words = useMemo(() => wordCount(finalText), [finalText])
  const seconds = Math.max(Math.round((words / WPM) * 60), 60)

  useEffect(() => {
    setTtsSupported('speechSynthesis' in window)
    loadVoices()
    preloadMusic()
    return () => sessionRef.current?.stop()
  }, [])

  function play() {
    const session = new MantraSession()
    sessionRef.current = session
    setProgress(0)
    setState('preparing')
    // На сайте озвучиваем только короткое превью (~15 с); полный текст —
    // при скачивании. Это быстрее и экономит синтез.
    session.start(previewText(finalText), voice, speed, {
      onReady: () => setState('playing'),
      onProgress: (f) => setProgress(f),
      onEnd: () => setState('done'),
    })
  }

  function togglePause() {
    const s = sessionRef.current
    if (!s) return
    if (state === 'playing') {
      s.pause()
      setState('paused')
    } else if (state === 'paused') {
      s.resume()
      setState('playing')
    }
  }

  function restart() {
    sessionRef.current?.stop()
    play()
  }

  function submitEmail() {
    if (!isValidEmail(email)) {
      setEmailError('Проверьте адрес — кажется, в нём опечатка.')
      return
    }
    setEmailError('')
    setStep('confirm')
  }

  async function pay() {
    if (paying) return
    setPaying(true)
    setPayError('')
    try {
      const order = await createOrder({ finalText, voice, speed }, email.trim())
      // Когда ЮKassa подключится, сервер вернёт confirmationUrl — уводим на кассу.
      // Пока оплаты нет, заказ создаётся сразу оплаченным и мы ведём на выдачу.
      if (order.confirmationUrl) {
        window.location.href = order.confirmationUrl
        return
      }
      navigate(order.orderUrl)
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Не удалось создать заказ.')
      setPaying(false)
    }
  }

  if (!finalText.trim()) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-ink-600">История ещё не готова.</p>
        <Link to="/review" className="btn-primary mt-6">
          Вернуться к истории
        </Link>
      </div>
    )
  }

  const isPlaying = state === 'playing'
  const isPreparing = state === 'preparing'
  const animate = isPlaying || isPreparing
  const pct = Math.round(progress * 100)

  function onOrbClick() {
    if (isPreparing) return
    if (state === 'idle' || state === 'done') play()
    else togglePause()
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 text-center">
      <h1 className="font-serif text-4xl text-ink-900">Ваша мантра готова</h1>
      <p className="mx-auto mt-2 max-w-md text-ink-600 leading-relaxed">
        Голос <span className="text-ink-900">{voiceById(voice).label}</span> читает
        вашу историю в медленном темпе на фоне альфа-волн. Здесь звучит короткое
        превью (~15 секунд) — полная запись доступна при скачивании.
      </p>

      {/* Breathing orb */}
      <div className="relative mx-auto my-12 grid h-64 w-64 place-items-center">
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-blob-clay to-blob-blush blur-2xl ${
            animate ? 'animate-breathe' : 'opacity-50'
          }`}
        />
        <div
          className={`absolute inset-6 rounded-full border border-white bg-white/50 ${
            animate ? 'animate-breathe' : ''
          }`}
        />
        <button
          onClick={onOrbClick}
          disabled={isPreparing}
          className="relative grid h-20 w-20 place-items-center rounded-full text-white shadow-glow transition-transform hover:scale-105 disabled:hover:scale-100"
          style={{ backgroundImage: 'linear-gradient(135deg,#c05b3a,#dd8a5f)' }}
          aria-label={isPreparing ? 'Готовим' : isPlaying ? 'Пауза' : 'Играть'}
        >
          {isPreparing ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-8 w-8" />
          ) : (
            <Play className="h-8 w-8 translate-x-0.5" />
          )}
        </button>
      </div>

      {/* Progress */}
      <div className="mx-auto max-w-sm">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-ink-400">
          <Headphones className="h-3.5 w-3.5" />
          {isPreparing
            ? 'Готовим голос…'
            : state === 'done'
            ? 'Прослушано полностью'
            : state === 'idle'
            ? `≈ ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')} · нажмите играть`
            : `${pct}%`}
        </div>
      </div>

      {state === 'done' && (
        <button
          onClick={restart}
          className="mt-6 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
        >
          <RotateCcw className="h-4 w-4" />
          Прослушать снова
        </button>
      )}

      {!ttsSupported && (
        <p className="mt-6 rounded-xl border border-[#e7b3c2] bg-[#fceef2] p-4 text-sm text-[#c0507a]">
          Ваш браузер не поддерживает синтез речи. Музыку альфа-волн можно
          скачать ниже, а озвучку — подключив TTS-провайдера.
        </p>
      )}

      {/* Покупка */}
      <div className="mt-12 rounded-3xl glass p-8">
        <h2 className="font-serif text-2xl text-ink-900">Забрать с собой</h2>

        {step === 'idle' && (
          <>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-500 leading-relaxed">
              Полная запись целиком — {PRICE_RUB} ₽. Чтобы слушать её каждый вечер
              в течение 30 дней.
            </p>
            <button onClick={() => setStep('email')} className="btn-primary mt-5">
              <CreditCard className="h-4 w-4" />
              Купить
            </button>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink-500 leading-relaxed">
              Нажав на эту кнопку, вы получите полную версию аудио после оплаты.
            </p>
            <PaymentConsentNote className="mx-auto mt-4 max-w-md" />
          </>
        )}

        {step === 'email' && (
          <div className="mx-auto mt-5 max-w-sm text-left">
            <label className="block text-sm text-ink-600">
              Куда отправить ссылку на запись
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitEmail()}
                placeholder="you@example.com"
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-ink-900 outline-none focus:border-brand/50"
              />
            </label>
            <p className="mt-2 text-xs text-ink-400 leading-relaxed">
              На этот адрес придёт ссылка на запись и чек об оплате.
            </p>
            {emailError && (
              <p className="mt-2 text-xs text-[#c0507a]">{emailError}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={submitEmail} className="btn-primary">
                Продолжить
              </button>
              <button
                onClick={() => setStep('idle')}
                className="text-sm text-ink-500 hover:text-ink-900"
              >
                Назад
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="mx-auto mt-5 max-w-md">
            <p className="text-sm text-ink-500">Отправим ссылку на запись на адрес</p>
            <p className="mt-1 font-medium text-ink-900 break-all">{email}</p>
            <p className="mx-auto mt-2 max-w-sm text-xs text-ink-400 leading-relaxed">
              Проверьте адрес — если в нём опечатка, письмо не дойдёт.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3">
              <button onClick={pay} disabled={paying} className="btn-primary">
                {paying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {paying ? 'Оформляем заказ…' : `Перейти к оплате · ${PRICE_RUB} ₽`}
              </button>
              <button
                onClick={() => setStep('email')}
                className="text-sm text-ink-500 hover:text-ink-900"
              >
                Изменить адрес
              </button>
            </div>
            {payError && (
              <p className="mx-auto mt-4 max-w-sm rounded-xl border border-[#e7b3c2] bg-[#fceef2] p-3 text-sm text-[#c0507a]">
                {payError}
              </p>
            )}
            <PaymentConsentNote className="mx-auto mt-5 max-w-md" />
          </div>
        )}
      </div>
    </div>
  )
}
