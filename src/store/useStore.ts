import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ROLES } from '../data/roles'
import { DEFAULT_VOICE } from '../data/voices'

interface State {
  /** roleId -> user's answer text */
  answers: Record<string, string>
  /** Compiled + possibly hand-edited final story used for narration */
  finalText: string
  /**
   * The compiled-from-answers value that `finalText` was last synced to.
   * Lets us tell "untouched" (finalText === snapshot) from "user edited it"
   * (finalText !== snapshot), so we can re-sync on answer changes without
   * clobbering manual edits.
   */
  finalSnapshot: string
  /** Selected SpeechKit voice id (see data/voices.ts). */
  voice: string
  setAnswer: (roleId: string, text: string) => void
  /** Manual edit of the final story — does NOT move the snapshot. */
  setFinalText: (text: string) => void
  /** Force finalText to the current compiled answers (and move the snapshot). */
  syncFinalFromAnswers: () => void
  setVoice: (v: string) => void
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
      finalSnapshot: '',
      voice: DEFAULT_VOICE,
      setAnswer: (roleId, text) =>
        set((s) => ({ answers: { ...s.answers, [roleId]: text } })),
      setFinalText: (text) => set({ finalText: text }),
      syncFinalFromAnswers: () => {
        const text = compile(get().answers)
        set({ finalText: text, finalSnapshot: text })
      },
      setVoice: (v) => set({ voice: v }),
      compileStory: () => compile(get().answers),
      reset: () =>
        set({ answers: {}, finalText: '', finalSnapshot: '', voice: 'female' }),
    }),
    { name: 'dream-life-story' },
  ),
)
