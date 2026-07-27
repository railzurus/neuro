export interface VoiceOption {
  /** SpeechKit voice id sent to the TTS proxy */
  id: string
  /** Display name */
  label: string
  gender: 'female' | 'male'
  desc: string
  recommended?: boolean
}

/** Voices available on the SpeechKit account, in display order. */
export const VOICES: VoiceOption[] = [
  { id: 'alena', label: 'Алёна', gender: 'female', desc: 'Тёплый, естественный', recommended: true },
  { id: 'marina', label: 'Марина', gender: 'female', desc: 'Живой, лёгкая интонация' },
  { id: 'jane', label: 'Джейн', gender: 'female', desc: 'Спокойный, ровный' },
  { id: 'omazh', label: 'Омаж', gender: 'female', desc: 'Глубокий, обволакивающий' },
  { id: 'oksana', label: 'Оксана', gender: 'female', desc: 'Классический, чёткий' },
  { id: 'filipp', label: 'Филипп', gender: 'male', desc: 'Тёплый, спокойный', recommended: true },
  { id: 'zahar', label: 'Захар', gender: 'male', desc: 'Низкий, уверенный' },
  { id: 'ermil', label: 'Ермил', gender: 'male', desc: 'Бодрый, дружелюбный' },
  { id: 'madirus', label: 'Мадирус', gender: 'male', desc: 'Глубокий, размеренный' },
]

export const DEFAULT_VOICE = 'alena'

/** Normalise any stored value (incl. legacy 'female'/'male') to a valid id. */
export function normalizeVoiceId(v: string | undefined): string {
  if (v && VOICES.some((x) => x.id === v)) return v
  if (v === 'male') return 'filipp'
  return DEFAULT_VOICE
}

export function voiceById(id: string): VoiceOption {
  return VOICES.find((v) => v.id === id) ?? VOICES[0]
}

/** Voice ids that are female — used only for the browser-speech fallback. */
export const FEMALE_VOICE_IDS = new Set(
  VOICES.filter((v) => v.gender === 'female').map((v) => v.id),
)
