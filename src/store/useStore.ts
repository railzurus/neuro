import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ROLES } from '../data/roles'

export type VoiceGender = 'female' | 'male'

interface State {
  /** roleId -> user's answer text */
  answers: Record<string, string>
  /** Compiled + hand-edited final story used for narration */
  finalText: string
  /** Whether finalText has been initialised from answers */
  finalTouched: boolean
  voice: VoiceGender
  setAnswer: (roleId: string, text: string) => void
  setFinalText: (text: string) => void
  setVoice: (v: VoiceGender) => void
  /** Assemble answers into one flowing story */
  compileStory: () => string
  reset: () => void
}

export function compile(answers: Record<string, string>): string {
  return ROLES.map((r) => (answers[r.id] || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      answers: {},
      finalText: '',
      finalTouched: false,
      voice: 'female',
      setAnswer: (roleId, text) =>
        set((s) => ({ answers: { ...s.answers, [roleId]: text } })),
      setFinalText: (text) => set({ finalText: text, finalTouched: true }),
      setVoice: (v) => set({ voice: v }),
      compileStory: () => compile(get().answers),
      reset: () =>
        set({ answers: {}, finalText: '', finalTouched: false, voice: 'female' }),
    }),
    { name: 'dream-life-story' },
  ),
)
