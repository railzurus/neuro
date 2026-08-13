import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ROLES } from '../data/roles'
import { DEFAULT_VOICE, DEFAULT_SPEED } from '../data/voices'
import { ensureSentenceEnd } from '../lib/refine'

/**
 * How the user is writing the text: by answering the nine role questions,
 * or by typing/pasting their own. The nine roles are one way to arrive at a
 * text, not the service itself.
 */
export type ComposeMode = 'roles' | 'own'

interface State {
  mode: ComposeMode
  setMode: (m: ComposeMode) => void
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
  /** Narration tempo multiplier. */
  speed: number
  setAnswer: (roleId: string, text: string) => void
  /** Manual edit of the final story — does NOT move the snapshot. */
  setFinalText: (text: string) => void
  /** Force finalText to the current compiled answers (and move the snapshot). */
  syncFinalFromAnswers: () => void
  setVoice: (v: string) => void
  setSpeed: (v: number) => void
  compileStory: () => string
  reset: () => void
}

/**
 * Join the per-role answers into one story. Each block is closed with a full
 * stop so the synthesized voice pauses between roles instead of reading them
 * as one endless sentence.
 */
export function compile(answers: Record<string, string>): string {
  return ROLES.map((r) => (answers[r.id] || '').trim())
    .filter(Boolean)
    .map(ensureSentenceEnd)
    .join('\n\n')
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      // 'roles' по умолчанию: у тех, кто начал до появления второго пути,
      // в сохранённом состоянии этого поля нет, и они должны остаться в ролях.
      mode: 'roles',
      setMode: (m) => set({ mode: m }),
      answers: {},
      finalText: '',
      finalSnapshot: '',
      voice: DEFAULT_VOICE,
      speed: DEFAULT_SPEED,
      setAnswer: (roleId, text) =>
        set((s) => ({ answers: { ...s.answers, [roleId]: text } })),
      setFinalText: (text) => set({ finalText: text }),
      syncFinalFromAnswers: () => {
        const text = compile(get().answers)
        set({ finalText: text, finalSnapshot: text })
      },
      setVoice: (v) => set({ voice: v }),
      setSpeed: (v) => set({ speed: v }),
      compileStory: () => compile(get().answers),
      reset: () =>
        set({
          mode: 'roles',
          answers: {},
          finalText: '',
          finalSnapshot: '',
          voice: DEFAULT_VOICE,
          speed: DEFAULT_SPEED,
        }),
    }),
    { name: 'dream-life-story' },
  ),
)
