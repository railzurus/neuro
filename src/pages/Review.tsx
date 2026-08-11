import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Loader2, Pause, Play, RefreshCw, Wand2 } from 'lucide-react'
import { useStore, compile } from '../store/useStore'
import { refineText, wordCount } from '../lib/refine'
import {
  VOICES,
  SPEEDS,
  normalizeVoiceId,
  normalizeSpeed,
  type VoiceOption,
  type SpeedOption,
} from '../data/voices'

const WPM = 85

export default function Review() {
  const navigate = useNavigate()
  const answers = useStore((s) => s.answers)
  const finalText = useStore((s) => s.finalText)
  const finalSnapshot = useStore((s) => s.finalSnapshot)
  const setFinalText = useStore((s) => s.setFinalText)
  const syncFinalFromAnswers = useStore((s) => s.syncFinalFromAnswers)
  const voice = useStore((s) => s.voice)
  const setVoice = useStore((s) => s.setVoice)
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)

  const [refining, setRefining] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)

  // Migrate any legacy stored voice/speed to valid values.
  useEffect(() => {
    const nv = normalizeVoiceId(voice)
    if (nv !== voice) setVoice(nv)
    const ns = normalizeSpeed(speed)
    if (ns !== speed) setSpeed(ns)
    return () => previewRef.current?.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function togglePreview(key: string, src: string) {
    const el = previewRef.current
    if (!el) return
    if (previewing === key) {
      el.pause()
      setPreviewing(null)
      return
    }
    el.src = src
    el.play().then(() => setPreviewing(key)).catch(() => setPreviewing(null))
  }

  const compiled = compile(answers)
  const hasAnswers = compiled.trim() !== ''
  // The user hand-edited the story and answers no longer match it.
  const diverged = finalText.trim() !== '' && finalText !== compiled

  // Keep the story in sync with the answers unless the user edited it by hand.
  useEffect(() => {
    if (!finalText.trim() || finalText === finalSnapshot) {
      syncFinalFromAnswers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compiled])

  const words = useMemo(() => wordCount(finalText), [finalText])
  const seconds = Math.round((words / WPM) * 60)
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60

  async function handleRefine() {
    if (!finalText.trim() || refining) return
    setRefining(true)
    try {
      setFinalText(await refineText(finalText))
    } finally {
      setRefining(false)
    }
  }

  if (!hasAnswers) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-ink-600">
          Сначала опишите хотя бы одну из ваших жизненных ролей.
        </p>
        <Link to="/compose" className="btn-primary mt-6">
          Перейти к описанию
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24">
      <h1 className="font-serif text-4xl text-ink-900">Ваша история</h1>
      <p className="mt-2 text-ink-600 leading-relaxed">
        Вот образ жизни вашей мечты, собранный из ваших ответов. Перечитайте его
        вслух и доведите до идеала — каждое слово должно откликаться.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="chip">{words} слов</span>
        <span className="chip">
          ≈ {mm}:{ss.toString().padStart(2, '0')} звучания
        </span>
        <span className="chip">темп {WPM} слов/мин</span>
      </div>

      {diverged && (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-brand/30 bg-brand/[0.06] p-4 text-sm text-ink-700 sm:flex-row sm:items-center sm:justify-between">
          <span>Ответы изменились и не совпадают с этим текстом.</span>
          <button
            onClick={syncFinalFromAnswers}
            className="inline-flex items-center gap-2 self-start rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white sm:self-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Собрать заново из ответов
          </button>
        </div>
      )}

      <textarea
        value={finalText}
        onChange={(e) => setFinalText(e.target.value)}
        rows={16}
        className="mt-4 w-full resize-none rounded-2xl border border-black/[0.07] bg-white p-5 font-serif text-lg leading-relaxed text-ink-900 shadow-soft focus:border-brand/60"
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <button onClick={syncFinalFromAnswers} className="btn-outline">
          <RefreshCw className="h-4 w-4" />
          Собрать из ответов
        </button>
        <button
          onClick={handleRefine}
          disabled={!finalText.trim() || refining}
          className="btn-outline"
        >
          {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {refining ? 'Правим…' : 'Поправь весь текст'}
        </button>
      </div>

      <audio ref={previewRef} onEnded={() => setPreviewing(null)} className="hidden" />

      {/* Tempo choice */}
      <h2 className="mt-12 font-serif text-2xl text-ink-900">Выберите темп</h2>
      <p className="mt-1 text-sm text-ink-500">
        Насколько медленно читать. Нажмите ▶, чтобы услышать разницу.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {SPEEDS.map((s) => (
          <SpeedChoice
            key={s.value}
            s={s}
            active={speed === s.value}
            playing={previewing === `speed-${s.value}`}
            onSelect={() => setSpeed(s.value)}
            onPreview={() => togglePreview(`speed-${s.value}`, s.sample)}
          />
        ))}
      </div>

      {/* Voice choice */}
      <h2 className="mt-12 font-serif text-2xl text-ink-900">Выберите голос</h2>
      <p className="mt-1 text-sm text-ink-500">
        Нажмите ▶, чтобы послушать пример, и выберите голос для вашей записи.
      </p>

      {(['female', 'male'] as const).map((g) => (
        <div key={g} className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
            {g === 'female' ? 'Женские' : 'Мужские'}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {VOICES.filter((v) => v.gender === g).map((v) => (
              <VoiceChoice
                key={v.id}
                v={v}
                active={voice === v.id}
                playing={previewing === v.id}
                onSelect={() => setVoice(v.id)}
                onPreview={() => togglePreview(v.id, `/voices/${v.id}.mp3`)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Nav */}
      <div className="mt-12 flex items-center justify-between">
        <button onClick={() => navigate('/compose')} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          К ролям
        </button>
        <button
          onClick={() => navigate('/listen')}
          disabled={!finalText.trim()}
          className="btn-primary"
        >
          Прослушать и скачать
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function VoiceChoice({
  v,
  active,
  playing,
  onSelect,
  onPreview,
}: {
  v: VoiceOption
  active: boolean
  playing: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
        active
          ? 'border-brand/60 bg-brand/[0.06] shadow-soft'
          : 'border-black/[0.07] bg-white'
      }`}
    >
      <button
        onClick={onPreview}
        aria-label={playing ? 'Остановить' : 'Прослушать'}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
          playing
            ? 'bg-brand text-white'
            : 'bg-black/[0.04] text-ink-600 hover:bg-brand/10 hover:text-brand'
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>
      <button onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="font-medium text-ink-900">{v.label}</span>
          {v.recommended && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              рекомендуем
            </span>
          )}
        </span>
        <span className="block text-xs text-ink-400">{v.desc}</span>
      </button>
      {active ? (
        <Check className="h-5 w-5 shrink-0 text-brand" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border border-black/15" />
      )}
    </div>
  )
}

function SpeedChoice({
  s,
  active,
  playing,
  onSelect,
  onPreview,
}: {
  s: SpeedOption
  active: boolean
  playing: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
        active
          ? 'border-brand/60 bg-brand/[0.06] shadow-soft'
          : 'border-black/[0.07] bg-white'
      }`}
    >
      <button
        onClick={onPreview}
        aria-label={playing ? 'Остановить' : 'Прослушать'}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
          playing
            ? 'bg-brand text-white'
            : 'bg-black/[0.04] text-ink-600 hover:bg-brand/10 hover:text-brand'
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>
      <button onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-ink-900">{s.label}</span>
          {s.recommended && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              рекомендуем
            </span>
          )}
        </span>
        <span className="block text-xs text-ink-400">{s.hint}</span>
      </button>
      {active ? (
        <Check className="h-5 w-5 shrink-0 text-brand" />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border border-black/15" />
      )}
    </div>
  )
}
