import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Wand2 } from 'lucide-react'
import { useStore, compile } from '../store/useStore'
import { refineText, wordCount } from '../lib/refine'

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

  const [refining, setRefining] = useState(false)

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

      {/* Voice choice */}
      <h2 className="mt-12 font-serif text-2xl text-ink-900">Выберите голос</h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <VoiceCard
          active={voice === 'female'}
          onClick={() => setVoice('female')}
          icon={<span className="text-xl leading-none">♀</span>}
          title="Женский"
          desc="Мягкий, обволакивающий"
        />
        <VoiceCard
          active={voice === 'male'}
          onClick={() => setVoice('male')}
          icon={<span className="text-xl leading-none">♂</span>}
          title="Мужской"
          desc="Тёплый, спокойный"
        />
      </div>

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

function VoiceCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-all ${
        active
          ? 'border-brand/60 bg-brand/[0.06] shadow-soft'
          : 'border-black/[0.07] bg-white hover:border-brand/30 hover:-translate-y-0.5'
      }`}
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-full ${
          active ? 'bg-brand/15 text-brand' : 'bg-black/[0.04] text-ink-500'
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block font-medium text-ink-900">{title}</span>
        <span className="block text-xs text-ink-400">{desc}</span>
      </span>
    </button>
  )
}
