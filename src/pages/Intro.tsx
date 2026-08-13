import { Link } from 'react-router-dom'
import { ArrowRight, ListChecks, Moon, PenLine, Sparkles } from 'lucide-react'
import { MANIFESTO, RITUAL, ROLES, TOTAL_WORD_LIMIT } from '../data/roles'
import { SPEEDS, VOICES } from '../data/voices'
import { RoleIconTile } from '../components/RoleIcon'
import { StartConsentNote } from '../components/Legal'
import { useStore } from '../store/useStore'

export default function Intro() {
  const setMode = useStore((s) => s.setMode)

  // Плавно, а не прыжком: обычный якорь #method сработал бы мгновенно, и
  // не было бы понятно, что мы всё ещё на той же странице.
  function scrollToMethod() {
    document.getElementById('method')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-20">
      {/* Hero */}
      <section className="relative pt-10 pb-16 text-center">
        <div className="pointer-events-none absolute left-1/2 top-6 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-blob-clay/70 blur-3xl animate-breathe" />
        <span className="mb-5 inline-grid h-14 w-14 place-items-center rounded-full bg-white shadow-soft border border-black/5">
          <Moon className="h-7 w-7 text-brand" />
        </span>
        <h1 className="font-serif text-5xl sm:text-6xl leading-[1.05] text-ink-900 animate-fadeup">
          Прояви жизнь
          <br />
          <span className="bg-gradient-to-r from-brand to-[#e0a05f] bg-clip-text text-transparent">
            своей мечты
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-ink-600 leading-relaxed">
          Мы поможем вам описать образ и положим его на альфа-волны для
          прослушивания перед сном. Тридцать ваших вечеров — и Вселенная
          позаботится об остальном.
        </p>

        {/* Два пути к тексту */}
        <div className="mt-9 grid gap-3 text-left sm:grid-cols-2">
          <PathCard
            to="/review"
            onClick={() => setMode('own')}
            icon={<PenLine className="h-5 w-5" />}
            title="На основе вашего текста"
            body="Вставьте готовый — аффирмации, молитву, свои слова. Выберете голос и темп."
            cta="Вставить текст"
            primary
          />
          <PathCard
            onClick={scrollToMethod}
            icon={<ListChecks className="h-5 w-5" />}
            title="Поможем описать образ"
            body="Проведём по девяти вопросам о жизни вашей мечты — из ответов соберётся текст."
            cta="Как это устроено"
          />
        </div>
        <StartConsentNote className="mx-auto mt-5 max-w-md text-center" />
      </section>

      {/* Как это работает */}
      <section className="border-t border-black/[0.06] pt-14">
        <h2 className="font-serif text-3xl text-ink-900 mb-7">Как это работает</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: 'Текст',
              body: `Свой или собранный по нашим вопросам. До ${TOTAL_WORD_LIMIT} слов — примерно 15 минут звучания.`,
            },
            {
              title: 'Голос и темп',
              body: `${VOICES.length} голосов и ${SPEEDS.length} скорости чтения. Каждый можно послушать заранее.`,
            },
            {
              title: 'Запись',
              body: 'Голос ложится на альфа-волны. Слушаете онлайн или скачиваете MP3.',
            },
          ].map((step, i) => (
            <li key={i} className="rounded-2xl glass p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 font-serif text-brand">
                {i + 1}
              </span>
              <h3 className="mt-3 font-medium text-ink-900">{step.title}</h3>
              <p className="mt-1 text-sm text-ink-500 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Метод — как один из способов написать текст */}
      <section id="method" className="mt-16 scroll-mt-6 rounded-3xl glass p-8 sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-4 py-1.5 text-xs text-ink-600 shadow-soft">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          Метод Лизы Головиной
        </div>
        <h2 className="mt-5 font-serif text-3xl text-ink-900">
          Не знаете, с чего начать?
        </h2>
        <p className="mt-3 text-ink-600 leading-relaxed">
          Мы проведём вас по девяти вопросам, и из ваших ответов сложится текст.
          Метод создан на основе 26 лет медитаций, подходов Хосе Сильвы, Ошо,
          Колина Типпинга, НЛП и когнитивно-поведенческой терапии.
        </p>

        <p className="mt-8 font-serif text-2xl text-brand">
          Реальность — отражение наших представлений о ней.
        </p>
        <div className="mt-4 space-y-4">
          {MANIFESTO.map((p, i) => (
            <p key={i} className="text-ink-600 leading-relaxed">
              {p}
            </p>
          ))}
        </div>
        <blockquote className="mt-6 rounded-2xl border border-black/[0.06] bg-white/60 p-6 font-serif text-xl italic text-ink-700">
          «Благодари Бога за то, что у тебя есть, и он даст тебе неизмеримо
          больше» 😊
        </blockquote>

        {/* Roles preview */}
        <h3 className="mt-10 font-serif text-2xl text-ink-900">Девять ролей</h3>
        <p className="mt-2 mb-6 text-ink-500 leading-relaxed">
          Вы опишете, как выглядит жизнь вашей мечты в каждой из ключевых
          жизненных ролей. По одной за раз, спокойно и без спешки.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ROLES.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-black/[0.06] bg-white/60 p-4 transition-transform hover:-translate-y-1"
            >
              <RoleIconTile id={r.id} />
              <div className="mt-3 font-medium text-ink-900">{r.title}</div>
              <div className="text-xs text-ink-400">{r.tagline}</div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link to="/compose" onClick={() => setMode('roles')} className="btn-primary">
            Пройти по вопросам
            <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="ml-3 text-xs text-ink-400">Занимает 10–15 минут</span>
        </div>
      </section>

      {/* Ritual */}
      <section className="mt-16">
        <h2 className="font-serif text-3xl text-ink-900 mb-3">Порядок исполнения</h2>
        <p className="text-ink-500 mb-8 leading-relaxed">
          Как пользоваться готовой записью, чтобы образ закрепился.
        </p>
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

      {/* CTA */}
      <section className="mt-16 text-center">
        <div className="rounded-3xl glass p-10">
          <h2 className="font-serif text-3xl text-ink-900">
            Начните проявлять свою жизнь
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-500">
            Положите свой образ на альфа-волны и слушайте перед сном. Тридцать
            вечеров — и Вселенная позаботится об остальном.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/review" onClick={() => setMode('own')} className="btn-primary">
              На основе вашего текста
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/compose" onClick={() => setMode('roles')} className="btn-outline">
              Поможем описать образ
            </Link>
          </div>
          <StartConsentNote className="mx-auto mt-4 max-w-md" />
        </div>
      </section>
    </div>
  )
}

/**
 * Карточка одного из путей к тексту. С `to` — ссылка на страницу, без него —
 * кнопка: путь «поможем описать образ» никуда не уводит, а прокручивает к
 * описанию метода на этой же странице.
 */
function PathCard({
  to,
  onClick,
  icon,
  title,
  body,
  cta,
  primary = false,
}: {
  to?: string
  onClick: () => void
  icon: React.ReactNode
  title: string
  body: string
  cta: string
  primary?: boolean
}) {
  const className = `group flex flex-col rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${
    primary
      ? 'border-brand/50 bg-white shadow-soft hover:border-brand'
      : 'border-black/[0.07] bg-white/70 hover:border-black/15'
  }`

  const inner = (
    <>
      <span
        className={`grid h-10 w-10 place-items-center rounded-full ${
          primary ? 'bg-brand/10 text-brand' : 'bg-black/[0.04] text-ink-600'
        }`}
      >
        {icon}
      </span>
      <span className="mt-3 font-medium text-ink-900">{title}</span>
      <span className="mt-1 flex-1 text-sm text-ink-500 leading-relaxed">{body}</span>
      <span
        className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${
          primary ? 'text-brand' : 'text-ink-600'
        }`}
      >
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </>
  )

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  )
}
