/**
 * Text refinement — the "Поправь текст" action.
 *
 * STUB: runs a set of safe, local heuristics (whitespace, punctuation,
 * capitalisation) so the button works fully offline with no API key.
 *
 * To upgrade to real AI editing (grammar, positive first-person present-tense
 * rewriting per Лиза Головина's method), replace the body with a call to your
 * backend, e.g.:
 *
 *   const res = await fetch('/api/refine', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ text }),
 *   })
 *   return (await res.json()).text
 *
 * The backend would proxy an LLM with a system prompt enforcing:
 *  - только позитивные утверждения,
 *  - от первого лица,
 *  - настоящее время,
 *  - задействованы аудиальная / кинестетическая / визуальная системы.
 */
export async function refineText(text: string): Promise<string> {
  if (!text.trim()) return text
  // Real editing via YandexGPT (server proxy). Falls back to local
  // normalisation if the endpoint isn't configured or errors.
  try {
    const res = await fetch('/api/refine.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data.text === 'string' && data.text.trim()) {
        return data.text.trim()
      }
    }
  } catch {
    /* fall through to local normalisation */
  }
  return normalize(text)
}

function normalize(input: string): string {
  let t = input.replace(/\r\n/g, '\n')

  // Collapse runs of spaces/tabs, keep paragraph breaks.
  t = t
    .split('\n')
    .map((line) =>
      line
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.;:!?…»)])/g, '$1') // no space before closing punctuation
        .replace(/([«(])\s+/g, '$1') // no space after opening punctuation
        .replace(/([,.;:!?])(?=[^\s.,;:!?…»)])/g, '$1 ') // space after punctuation
        .replace(/ -- | - /g, ' — ') // normalise dashes
        .trim(),
    )
    .join('\n')

  // Collapse 3+ newlines to a paragraph break.
  t = t.replace(/\n{3,}/g, '\n\n').trim()

  // Capitalise the first letter of each sentence and paragraph.
  t = t.replace(/(^|[.!?…]\s+|\n\s*)([а-яёa-z])/g, (_m, pre, ch) => pre + ch.toUpperCase())

  // Ensure the text ends with terminal punctuation.
  if (t && !/[.!?…]$/.test(t)) t += '.'

  return t
}

/* ------------------------------------------------------------------ */
/*  Техническая подготовка текста к синтезу речи                       */
/* ------------------------------------------------------------------ */

/**
 * Результат подготовки на сессию. Один и тот же текст озвучивается несколько
 * раз (превью на сайте, сборка заказа, пересборка на странице выдачи), а
 * каждый вызов GPT платный и небыстрый.
 */
const ttsCache = new Map<string, string>()

/** Разметка SpeechKit, которую добавляет технический редактор. */
const TTS_MARKUP = /sil<\[\d+\]>|<\[accented\]>/g

/**
 * Доля слов исходника, которую обязан сохранить подготовленный текст.
 * Страховка от обрыва ответа модели по лимиту токенов: в синтез не должен
 * уйти текст, у которого отрезало конец.
 */
const MIN_KEPT_WORDS = 0.85

/** Считает слова без учёта разметки и знаков ударения. */
function spokenWordCount(text: string): number {
  return wordCount(text.replace(TTS_MARKUP, ' ').replace(/\+/g, ''))
}

/**
 * Готовит текст к озвучиванию: ё, ударения в омографах, числа прописью,
 * разбивка на медитативные фразы и разметка пауз sil<[мс]> / акцентов
 * <[accented]> (поддерживается SpeechKit в API v1 для формата text).
 *
 * Вызывается перед отправкой в SpeechKit и НИКОГДА не показывается
 * пользователю — в интерфейсе и в заказе остаётся его собственный текст.
 * При любой ошибке возвращает исходный текст: без разметки запись звучит
 * чуть ровнее, но синтез не ломается.
 */
export async function prepareForTts(text: string): Promise<string> {
  const source = text.trim()
  if (!source) return text

  const cached = ttsCache.get(source)
  if (cached !== undefined) return cached

  let prepared = source
  try {
    const res = await fetch('/api/refine.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source, mode: 'tts' }),
    })
    if (res.ok) {
      const data = await res.json()
      const candidate = typeof data?.text === 'string' ? data.text.trim() : ''
      if (candidate && spokenWordCount(candidate) >= spokenWordCount(source) * MIN_KEPT_WORDS) {
        prepared = candidate
      } else if (candidate) {
        console.warn('[prepareForTts] ответ короче исходника — озвучиваем как есть')
      }
    }
  } catch {
    /* эндпоинта нет или сеть отвалилась — озвучиваем исходный текст */
  }

  // Неудачу тоже запоминаем: иначе каждое повторное проигрывание снова ждёт
  // ответа от недоступного эндпоинта.
  ttsCache.set(source, prepared)
  return prepared
}

/** A line already finished by terminal punctuation (possibly inside quotes/brackets). */
const TERMINATED = /[.!?…]\s*["'»)\]]*$/

/**
 * Make sure every non-empty line of a block ends with terminal punctuation.
 *
 * The synthesized voice pauses on sentence boundaries, so an answer left
 * without a final dot would run straight into the next role's text.
 */
export function ensureSentenceEnd(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // Drop trailing separators the user left dangling (", ", " —", ";" …).
      const t = line.replace(/[\s,;:—–-]+$/, '').trimEnd()
      if (!t.trim()) return ''
      return TERMINATED.test(t) ? t : `${t}.`
    })
    .join('\n')
}

export function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** «5 слов», «2 слова», «21 слово» — число вместе с нужной формой. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return `${n} ${many}`
  if (last > 1 && last < 5) return `${n} ${few}`
  if (last === 1) return `${n} ${one}`
  return `${n} ${many}`
}
