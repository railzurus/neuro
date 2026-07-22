import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { MANIFESTO, RITUAL, ROLES } from '../data/roles'

export default function Intro() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-20">
      {/* Hero */}
      <section className="relative pt-10 pb-16 text-center">
        <div className="pointer-events-none absolute left-1/2 top-6 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-blob-clay/70 blur-3xl animate-breathe" />
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-4 py-1.5 text-xs text-ink-600 shadow-soft">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          Метод Лизы Головиной · ZURUS Tech
        </div>
        <h1 className="font-serif text-5xl sm:text-6xl leading-[1.05] text-ink-900 animate-fadeup">
          Прояви жизнь
          <br />
          <span className="bg-gradient-to-r from-brand to-[#e0a05f] bg-clip-text text-transparent">
            своей мечты
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-ink-600 leading-relaxed">
          Создано на основе 26 лет медитаций, методов Хосе Сильвы, Ошо, Колина
          Типпинга, НЛП и когнитивно-поведенческой терапии.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3">
          <Link to="/compose" className="btn-primary group">
            Начните прямо сейчас
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <span className="text-xs text-ink-400">Занимает 10–15 минут</span>
        </div>
      </section>

      {/* Manifesto */}
      <section className="space-y-5 border-t border-black/[0.06] pt-14">
        <p className="font-serif text-2xl text-brand">
          Реальность — отражение наших представлений о ней.
        </p>
        {MANIFESTO.map((p, i) => (
          <p key={i} className="text-ink-600 leading-relaxed">
            {p}
          </p>
        ))}
        <blockquote className="mt-6 rounded-2xl glass p-6 font-serif text-xl italic text-ink-700">
          «Благодари Бога за то, что у тебя есть, и он даст тебе неизмеримо
          больше» 😊
        </blockquote>
      </section>

      {/* Ritual */}
      <section className="mt-16">
        <h2 className="font-serif text-3xl text-ink-900 mb-8">Порядок исполнения</h2>
        <ol className="space-y-4">
          {RITUAL.map((step, i) => (
            <li key={i} className="flex gap-4 rounded-2xl glass p-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 font-serif text-brand">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium text-ink-900">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-500 leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Roles preview */}
      <section className="mt-16">
        <h2 className="font-serif text-3xl text-ink-900 mb-3">Ваши девять ролей</h2>
        <p className="text-ink-500 mb-7 leading-relaxed">
          Вы опишете, как выглядит жизнь вашей мечты в каждой из ключевых
          жизненных ролей. По одной за раз, спокойно и без спешки.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ROLES.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl glass p-4 transition-transform hover:-translate-y-1"
            >
              <div className="text-2xl">{r.glyph}</div>
              <div className="mt-2 font-medium text-ink-900">{r.title}</div>
              <div className="text-xs text-ink-400">{r.tagline}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 text-center">
        <div className="rounded-3xl glass p-10">
          <h2 className="font-serif text-3xl text-ink-900">
            Начните проявлять свою жизнь
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-500">
            Опишите образ, положите его на альфа-волны и слушайте перед сном.
            Тридцать вечеров — и Вселенная позаботится об остальном.
          </p>
          <Link to="/compose" className="btn-primary mt-7">
            Начать
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
