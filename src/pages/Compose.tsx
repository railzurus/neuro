import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Wand2, Loader2 } from 'lucide-react'
import { ROLES, WORD_LIMIT } from '../data/roles'
import { useStore } from '../store/useStore'
import { refineText, wordCount } from '../lib/refine'

export default function Compose() {
  const navigate = useNavigate()
  const answers = useStore((s) => s.answers)
  const setAnswer = useStore((s) => s.setAnswer)

  const [step, setStep] = useState(() => {
    // Resume at the first unanswered role.
    const firstEmpty = ROLES.findIndex((r) => !(answers[r.id] || '').trim())
    return firstEmpty === -1 ? 0 : firstEmpty
  })
  const [refining, setRefining] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const role = ROLES[step]
  const value = answers[role.id] || ''
  const words = useMemo(() => wordCount(value), [value])
  const overLimit = words > WORD_LIMIT
  const completedCount = ROLES.filter((r) => (answers[r.id] || '').trim()).length

  useEffect(() => {
    taRef.current?.focus()
  }, [step])

  async function handleRefine() {
    if (!value.trim() || refining) return
    setRefining(true)
    try {
      const fixed = await refineText(value)
      setAnswer(role.id, fixed)
    } finally {
      setRefining(false)
    }
  }

  const isLast = step === ROLES.length - 1

  function goNext() {
    if (isLast) {
      navigate('/review')
    } else {
      setStep((s) => Math.min(s + 1, ROLES.length - 1))
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24">
      {/* Progress rail */}
      <div className="sticky top-0 z-10 -mx-6 mb-8 bg-canvas/80 px-6 py-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-ink-500">
            Роль {step + 1} из {ROLES.length}
          </span>
          <span className="text-ink-400">{completedCount} заполнено</span>
        </div>
        <div className="flex gap-1.5">
          {ROLES.map((r, i) => {
            const done = (answers[r.id] || '').trim()
            const active = i === step
            return (
              <button
                key={r.id}
                onClick={() => setStep(i)}
                title={r.title}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  active
                    ? 'bg-brand'
                    : done
                    ? 'bg-brand/40'
                    : 'bg-black/10 hover:bg-black/20'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* Assistant question bubble */}
      <div className="animate-fadeup" key={role.id}>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-3xl">{role.glyph}</span>
          <div>
            <h1 className="font-serif text-3xl text-ink-900">{role.title}</h1>
            <p className="text-sm text-ink-400">{role.tagline}</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl rounded-tl-sm glass p-5 text-ink-700 leading-relaxed">
          {role.prompt}
        </div>

        {/* Composer */}
        <div className="mt-5">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setAnswer(role.id, e.target.value)}
            placeholder="Пишите от первого лица, в настоящем времени, как будто это уже происходит…"
            rows={7}
            className={`w-full resize-none rounded-2xl border bg-white p-5 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-300 shadow-soft transition-colors focus:border-brand/60 ${
              overLimit ? 'border-blob-blush' : 'border-black/[0.07]'
            }`}
          />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className={overLimit ? 'text-[#d1567a]' : 'text-ink-400'}>
              {words} / {WORD_LIMIT} слов
              {overLimit && ' — немного сократите'}
            </span>
            <button
              onClick={handleRefine}
              disabled={!value.trim() || refining}
              className="btn-outline"
            >
              {refining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {refining ? 'Правим…' : 'Поправь текст'}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Кнопка аккуратно приведёт в порядок пунктуацию и заглавные буквы.
            Дальше доведите текст до идеала сами.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
          className="btn-ghost disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>
        <button onClick={goNext} disabled={overLimit} className="btn-primary">
          {isLast ? (
            <>
              К предпросмотру
              <Check className="h-4 w-4" />
            </>
          ) : (
            <>
              Далее
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
