import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, Pause, Play, RotateCcw, Headphones } from 'lucide-react'
import { useStore } from '../store/useStore'
import { wordCount } from '../lib/refine'
import {
  MantraSession,
  loadVoices,
  preloadMusic,
  renderMix,
  synthesizeVoice,
} from '../lib/audio'

const WPM = 85

type PlayState = 'idle' | 'preparing' | 'playing' | 'paused' | 'done'

export default function Listen() {
  const finalText = useStore((s) => s.finalText)
  const voice = useStore((s) => s.voice)

  const sessionRef = useRef<MantraSession | null>(null)
  const [state, setState] = useState<PlayState>('idle')
  const [progress, setProgress] = useState(0)
  const [rendering, setRendering] = useState(false)
  const [ttsSupported, setTtsSupported] = useState(true)

  const words = useMemo(() => wordCount(finalText), [finalText])
  const seconds = Math.max(Math.round((words / WPM) * 60), 60)
  const bedSeconds = Math.max(seconds + 20, 180)

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
    session.start(finalText, voice, {
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

  async function download() {
    if (rendering) return
    setRendering(true)
    try {
      // Real voice from SpeakKit if configured; otherwise music-only.
      const voiceBuffer = await synthesizeVoice(finalText, voice)
      const dur = voiceBuffer ? voiceBuffer.duration + 8 : bedSeconds
      const blob = await renderMix(dur, voiceBuffer)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = voiceBuffer
        ? 'жизнь-мечты-голос-и-музыка.wav'
        : 'альфа-волны-жизнь-мечты.wav'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setRendering(false)
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
        {voice === 'female' ? 'Женский' : 'Мужской'} голос читает вашу историю в
        медленном темпе на фоне альфа-волн. Устройтесь удобно, наденьте наушники
        и закройте глаза.
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

      {/* Download */}
      <div className="mt-12 rounded-3xl glass p-8">
        <h2 className="font-serif text-2xl text-ink-900">Забрать с собой</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-500 leading-relaxed">
          Скачайте запись, чтобы слушать её каждый вечер в течение 30 дней. Если
          подключён голос (SpeechKit) — в файле будут голос и музыка вместе; если
          нет — только дорожка альфа-волн.
        </p>
        <button onClick={download} disabled={rendering} className="btn-primary mt-5">
          {rendering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {rendering ? 'Готовим файл…' : 'Скачать запись (WAV)'}
        </button>
      </div>
    </div>
  )
}
