/**
 * Audio engine for the dream-life mantra.
 *
 *  - Alpha-wave bed: real binaural beat (~10 Hz) generated live with the Web
 *    Audio API — two sine carriers panned hard left/right plus a soft, slowly
 *    breathing pad. No external files or API keys required.
 *  - Voice: the browser SpeechSynthesis API reads the user's own text at a slow,
 *    even pace (~85 words/min), split into sentences for reliable long-text
 *    playback and progress reporting.
 *
 * PROVIDER HOOK: to ship studio-quality voiced downloads, swap `speakSentence`
 * and the download path for a backend TTS call (Yandex SpeakKit / OpenAI /
 * ElevenLabs) that returns an audio buffer, then mix it with the bed offline.
 */

const CARRIER = 196 // base carrier (G3) — warm, unobtrusive
const BEAT = 10 // Hz difference => alpha range (8–12 Hz)
const BED_GAIN = 0.14

export interface BedNodes {
  stop: (fadeSec?: number) => void
  setVolume: (v: number) => void
}

/** Build and start the alpha-wave bed on a live AudioContext. */
export function startBed(ctx: AudioContext): BedNodes {
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(BED_GAIN, now + 4)
  master.connect(ctx.destination)

  // --- Binaural carriers, one per ear ---
  const merger = ctx.createChannelMerger(2)
  const left = ctx.createOscillator()
  const right = ctx.createOscillator()
  left.type = 'sine'
  right.type = 'sine'
  left.frequency.value = CARRIER
  right.frequency.value = CARRIER + BEAT
  const lg = ctx.createGain()
  const rg = ctx.createGain()
  lg.gain.value = 0.9
  rg.gain.value = 0.9
  left.connect(lg).connect(merger, 0, 0)
  right.connect(rg).connect(merger, 0, 1)
  merger.connect(master)

  // --- Soft breathing pad for musicality ---
  const pad = ctx.createGain()
  pad.gain.value = 0.5
  const padFilter = ctx.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 520
  const padA = ctx.createOscillator()
  const padB = ctx.createOscillator()
  padA.type = 'triangle'
  padB.type = 'triangle'
  padA.frequency.value = CARRIER / 2
  padB.frequency.value = CARRIER / 2 + 0.3 // gentle detune => slow chorus
  padA.connect(pad)
  padB.connect(pad)
  pad.connect(padFilter).connect(master)

  // Slow amplitude "breath" LFO on the pad.
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.1 // ~10 s cycle
  lfoGain.gain.value = 0.25
  lfo.connect(lfoGain).connect(pad.gain)

  ;[left, right, padA, padB, lfo].forEach((o) => o.start(now))

  return {
    stop(fadeSec = 2) {
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t)
      master.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec)
      const stopAt = t + fadeSec + 0.05
      ;[left, right, padA, padB, lfo].forEach((o) => {
        try {
          o.stop(stopAt)
        } catch {
          /* already stopped */
        }
      })
    },
    setVolume(v) {
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.linearRampToValueAtTime(Math.max(v, 0.0001), t + 0.3)
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Voice selection                                                    */
/* ------------------------------------------------------------------ */

let cachedVoices: SpeechSynthesisVoice[] = []

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = speechSynthesis.getVoices()
    if (existing.length) {
      cachedVoices = existing
      resolve(existing)
      return
    }
    const handler = () => {
      cachedVoices = speechSynthesis.getVoices()
      resolve(cachedVoices)
      speechSynthesis.removeEventListener('voiceschanged', handler)
    }
    speechSynthesis.addEventListener('voiceschanged', handler)
    // Safety timeout in case the event never fires.
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1500)
  })
}

const FEMALE_HINTS = ['female', 'милена', 'milena', 'alena', 'алёна', 'алена', 'katya', 'катя', 'women', 'zira', 'anna']
const MALE_HINTS = ['male', 'юрий', 'yuri', 'pavel', 'павел', 'артём', 'artem', 'dmitry', 'дмитрий', 'guy', 'man']

export function pickVoice(gender: 'female' | 'male'): SpeechSynthesisVoice | undefined {
  const voices = cachedVoices.length ? cachedVoices : speechSynthesis.getVoices()
  const ru = voices.filter((v) => /ru/i.test(v.lang))
  const pool = ru.length ? ru : voices
  const hints = gender === 'female' ? FEMALE_HINTS : MALE_HINTS
  const byHint = pool.find((v) => hints.some((h) => v.name.toLowerCase().includes(h)))
  if (byHint) return byHint
  // Fall back: first Russian voice, else first available.
  return pool[0]
}

/* ------------------------------------------------------------------ */
/*  Mantra session (bed + narration together)                          */
/* ------------------------------------------------------------------ */

export interface SessionCallbacks {
  onProgress?: (fraction: number) => void
  onEnd?: () => void
}

/** Target ~85 words/min. Browser rate 1 ≈ ~150 wpm, so ~0.55. */
export const SLOW_RATE = 0.55

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export class MantraSession {
  private ctx: AudioContext | null = null
  private bed: BedNodes | null = null
  private sentences: string[] = []
  private idx = 0
  private stopped = false
  private cb: SessionCallbacks = {}

  get isActive() {
    return this.ctx !== null && !this.stopped
  }

  start(text: string, gender: 'female' | 'male', cb: SessionCallbacks = {}) {
    this.stop() // clean any previous run
    this.stopped = false
    this.cb = cb
    this.sentences = splitSentences(text)
    this.idx = 0

    const AC = window.AudioContext || (window as any).webkitAudioContext
    this.ctx = new AC()
    this.bed = startBed(this.ctx)

    // Give the bed a breath before the voice enters.
    setTimeout(() => this.speakNext(gender), 1800)
  }

  private speakNext(gender: 'female' | 'male') {
    if (this.stopped) return
    if (this.idx >= this.sentences.length) {
      this.finish()
      return
    }
    const sentence = this.sentences[this.idx]
    const u = new SpeechSynthesisUtterance(sentence)
    const voice = pickVoice(gender)
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else {
      u.lang = 'ru-RU'
    }
    u.rate = SLOW_RATE
    u.pitch = gender === 'male' ? 0.92 : 1.0
    u.volume = 1
    u.onend = () => {
      if (this.stopped) return
      this.idx += 1
      this.cb.onProgress?.(this.idx / this.sentences.length)
      // A soft pause between phrases keeps the delivery calm.
      setTimeout(() => this.speakNext(gender), 900)
    }
    u.onerror = () => {
      if (this.stopped) return
      this.idx += 1
      setTimeout(() => this.speakNext(gender), 300)
    }
    speechSynthesis.speak(u)
  }

  private finish() {
    this.cb.onProgress?.(1)
    this.bed?.stop(3)
    this.cb.onEnd?.()
    // Let the fade finish, then release the context.
    setTimeout(() => this.closeCtx(), 3500)
  }

  pause() {
    speechSynthesis.pause()
  }

  resume() {
    speechSynthesis.resume()
  }

  stop() {
    this.stopped = true
    try {
      speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
    this.bed?.stop(0.4)
    this.bed = null
    setTimeout(() => this.closeCtx(), 500)
  }

  private closeCtx() {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {})
    }
    this.ctx = null
  }
}

/* ------------------------------------------------------------------ */
/*  Offline render — downloadable alpha-wave bed (WAV)                  */
/* ------------------------------------------------------------------ */

/**
 * Render the alpha-wave bed to a WAV Blob of the given duration.
 * Used for the "Скачать" action. (A full voiced mix is produced server-side
 * once a TTS provider is connected — see the module header.)
 */
export async function renderBedWav(durationSec: number): Promise<Blob> {
  const sampleRate = 44100
  const OAC = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
  const ctx: OfflineAudioContext = new OAC(2, Math.ceil(sampleRate * durationSec), sampleRate)

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, 0)
  master.gain.exponentialRampToValueAtTime(BED_GAIN, 4)
  master.gain.setValueAtTime(BED_GAIN, durationSec - 4)
  master.gain.exponentialRampToValueAtTime(0.0001, durationSec)
  master.connect(ctx.destination)

  const merger = ctx.createChannelMerger(2)
  const left = ctx.createOscillator()
  const right = ctx.createOscillator()
  left.type = 'sine'
  right.type = 'sine'
  left.frequency.value = CARRIER
  right.frequency.value = CARRIER + BEAT
  const lg = ctx.createGain()
  const rg = ctx.createGain()
  lg.gain.value = 0.9
  rg.gain.value = 0.9
  left.connect(lg).connect(merger, 0, 0)
  right.connect(rg).connect(merger, 0, 1)
  merger.connect(master)

  const pad = ctx.createGain()
  pad.gain.value = 0.5
  const padFilter = ctx.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 520
  const padA = ctx.createOscillator()
  const padB = ctx.createOscillator()
  padA.type = 'triangle'
  padB.type = 'triangle'
  padA.frequency.value = CARRIER / 2
  padB.frequency.value = CARRIER / 2 + 0.3
  padA.connect(pad)
  padB.connect(pad)
  pad.connect(padFilter).connect(master)

  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.1
  lfoGain.gain.value = 0.25
  lfo.connect(lfoGain).connect(pad.gain)

  ;[left, right, padA, padB, lfo].forEach((o) => o.start(0))
  ;[left, right, padA, padB, lfo].forEach((o) => o.stop(durationSec))

  const buffer = await ctx.startRendering()
  return encodeWav(buffer)
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels
  const len = buffer.length * numCh * 2 + 44
  const ab = new ArrayBuffer(len)
  const view = new DataView(ab)
  const channels: Float32Array[] = []
  let offset = 0

  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i))
  }

  writeStr('RIFF')
  view.setUint32(offset, len - 8, true)
  offset += 4
  writeStr('WAVE')
  writeStr('fmt ')
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, numCh, true)
  offset += 2
  view.setUint32(offset, buffer.sampleRate, true)
  offset += 4
  view.setUint32(offset, buffer.sampleRate * numCh * 2, true)
  offset += 4
  view.setUint16(offset, numCh * 2, true)
  offset += 2
  view.setUint16(offset, 16, true)
  offset += 2
  writeStr('data')
  view.setUint32(offset, len - offset - 4, true)
  offset += 4

  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch))
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]))
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, sample, true)
      offset += 2
    }
  }

  return new Blob([ab], { type: 'audio/wav' })
}
