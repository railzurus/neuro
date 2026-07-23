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

export function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}
