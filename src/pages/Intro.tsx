import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Headphones, ListChecks, PenLine, Sparkles } from 'lucide-react'
import { RITUAL, ROLES, TOTAL_WORD_LIMIT } from '../data/roles'
import { SPEEDS, VOICES } from '../data/voices'
import { RoleIconTile } from '../components/RoleIcon'
import { StartConsentNote } from '../components/Legal'
import { useStore } from '../store/useStore'
import { getCreatedCount } from '../lib/stats'
import { plural } from '../lib/refine'

export default function Intro() {
  const setMode = useStore((s) => s.setMode)

  // null — счётчик ещё не загрузился или API недоступно. В обоих случаях
  // строка не показывается, чтобы не мигать заглушкой.
  const [created, setCreated] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    getCreatedCount().then((n) => {
      if (alive) setCreated(n)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-6 pb-20">
      {/* Hero */}
      <section className="relative pt-10 pb-16 text-center">
        <div className="pointer-events-none absolute left-1/2 top-6 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-blob-clay/70 blur-3xl animate-breathe" />
        <span className="mb-5 inline-grid h-14 w-14 place-items-center rounded-full bg-white shadow-soft border border-black/5">
          <Headphones className="h-7 w-7 text-brand" />
        </span>
        {/*
          Кегль меньше прежнего заголовка: фраза длиннее. На 36px строка
          «идеальную медитацию» упиралась в край колонки на мобильных,
          поэтому там 32px.
        */}
        <h1 className="font-serif text-[2rem] sm:text-5xl leading-[1.1] text-ink-900 animate-fadeup">
          Создайте свою
          <br />
          <span className="bg-gradient-to-r from-brand to-[#4cc0b2] bg-clip-text text-transparent">
            идеальную медитацию
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-ink-600 leading-relaxed">
          Мечтаете о жизни, где всё складывается легко и гармонично? Превратите
          свои представления о счастье и гармонии в персональную медитацию — она
          станет вашим проводником, мягко направляя к мечте и помогая обрести
          внутреннюю гармонию.
        </p>

        {created !== null && (
          <p className="mt-6 text-sm text-ink-500">
            Уже создано{' '}
            <span className="font-medium text-ink-900">
              {plural(created, 'медитация', 'медитации', 'медитаций')}
            </span>
          </p>
        )}

        {/* Два пути к тексту */}
        <div className="mt-9 grid gap-3 text-left sm:grid-cols-2">
          <PathCard
            to="/review"
            onClick={() => setMode('own')}
            icon={<PenLine className="h-5 w-5" />}
            title="На основе вашего текста"
            body="Вставьте готовый — аффирмации, молитву, свои слова. Выберете голос и темп."
            cta="Вставить текст"
          />
          <PathCard
            to="/compose"
            onClick={() => setMode('roles')}
            icon={<ListChecks className="h-5 w-5" />}
            title="Поможем описать образ"
            body="Проведём по девяти вопросам о жизни вашей мечты — из ответов соберётся текст."
            cta="Пройти по вопросам"
            primary
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
        {/*
          Выключка по формату: без неё рваный правый край на длинных абзацах
          выглядит неопрятно. hyphens-auto обязателен — иначе выключка растянет
          пробелы, и в русском тексте появятся «дыры» между словами.
        */}
        <div className="mt-4 space-y-4 hyphens-auto text-justify text-ink-600 leading-relaxed">
          <p>
            Мы проведём вас по девяти вопросам, и из ваших ответов сложится
            готовый текст — это будет ваша персональная медитация. Вам останется
            только слушать её 30 дней перед сном, и со временем ваше восприятие
            реальности начнёт меняться, а жизнь — подстраиваться под новый
            внутренний настрой.
          </p>
          <p>
            Этот метод основан на 26-летней практике медитаций и объединяет
            подходы Хосе Сильвы, Ошо, Колина Типпинга, НЛП и
            когнитивно-поведенческой терапии. Мы исходим из того, что реальность
            отражает наши представления о ней — и многие из них, особенно
            негативные, были усвоены в раннем детстве и потом, сами того не
            замечая, повторяются во взрослой жизни. Чтобы изменить мир вокруг,
            нужно сначала обновить своё внутреннее состояние. Если понадобится,
            искусственный интеллект поможет вам поправить или дополнить текст,
            чтобы вам было легче прийти к цели.
          </p>
          <p>
            В итоге вы получите аудиозапись: голос будет читать ваше собственное
            описание идеальной жизни в течение 3–5 минут в медленном темпе под
            фон альфа-волн. Текст состоит только из позитивных утверждений от
            первого лица в настоящем времени — так, будто это уже происходит с
            вами, — и задействует все каналы восприятия: зрение, слух и
            ощущения, чтобы вы могли глубже погрузиться в этот образ. Такой
            сценарий постепенно закрепится в подсознании и станет вашей новой
            жизненной программой.
          </p>
        </div>
        <blockquote className="mt-6 rounded-2xl border border-black/[0.06] bg-white/60 p-6 font-serif text-xl italic text-ink-700">
          «Благодари Бога за то, что у тебя есть, и он даст тебе неизмеримо
          больше»
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
            <Link to="/review" onClick={() => setMode('own')} className="btn-outline">
              На основе вашего текста
            </Link>
            <Link to="/compose" onClick={() => setMode('roles')} className="btn-primary">
              Поможем описать образ
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <StartConsentNote className="mx-auto mt-4 max-w-md" />
        </div>
      </section>
    </div>
  )
}

/** Карточка одного из путей к тексту: ссылка на страницу этого пути. */
function PathCard({
  to,
  onClick,
  icon,
  title,
  body,
  cta,
  primary = false,
}: {
  to: string
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

  return (
    <Link to={to} onClick={onClick} className={className}>
      {inner}
    </Link>
  )
}
