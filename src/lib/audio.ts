/**
 * Audio engine for the dream-life mantra.
 *
 *  - Music bed: a ready-made, licensed alpha/theta ambient track
 *    (`/music/alpha-tide.mp3`) is loaded, decoded, looped and played quietly
 *    under the voice. If it fails to load, we fall back to a live binaural
 *    beat (~10 Hz) generated with the Web Audio API — so there is always a bed.
 *  - Voice: the browser SpeechSynthesis API reads the user's own text at a slow,
 *    even pace (~85 words/min), split into sentences for reliable long-text
 *    playback and progress reporting.
 *  - Mixing: live playback mixes voice + music through the Web Audio graph;
 *    downloads are rendered offline (music looped to length, voice overlaid if
 *    an audio buffer is provided) — no server or ffmpeg required.
 *
 * PROVIDER HOOK: once a TTS backend (Yandex SpeakKit) returns the voice as an
 * audio file, decode it to an AudioBuffer and pass it to `renderMix` — the
 * download then contains voice + music baked into one file.
 */

const MUSIC_URL = '/music/alpha-tide.mp3'
/** Music level under the voice (0..1). Kept low so it never presses. */
const MUSIC_UNDER_VOICE = 0.2
/** Music level for a standalone (voice-less) download. */
const MUSIC_SOLO = 0.55
/** Seconds the bed plays alone before the voice enters. */
const VOICE_OFFSET = 1.8

// Binaural fallback settings (used only if the music file fails to load).
const CARRIER = 196
const BEAT = 10
const BED_GAIN = 0.14

export interface BedNodes {
  stop: (fadeSec?: number) => void
  setVolume: (v: number) => void
}

/* ------------------------------------------------------------------ */
/*  Music track loading (cached raw bytes, decoded per context)        */
/* ------------------------------------------------------------------ */

let rawMusic: ArrayBuffer | null = null

async function fetchMusicBytes(): Promise<ArrayBuffer> {
  if (!rawMusic) {
    const res = await fetch(MUSIC_URL)
    if (!res.ok) throw new Error(`music fetch failed: ${res.status}`)
    rawMusic = await res.arrayBuffer()
  }
  // decodeAudioData detaches the buffer, so hand out a copy each time.
  return rawMusic.slice(0)
}

/** Warm the cache early (e.g. on page load) so playback starts instantly. */
export function preloadMusic(): void {
  fetchMusicBytes().catch(() => {})
}

function decodeMusic(ctx: BaseAudioContext): Promise<AudioBuffer> {
  return fetchMusicBytes().then((bytes) => ctx.decodeAudioData(bytes))
}

/** Start the looped music track as the live bed. */
function startMusicBed(
  ctx: AudioContext,
  buffer: AudioBuffer,
  gain = MUSIC_UNDER_VOICE,
): BedNodes {
  const now = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(gain, now + 4)
  src.connect(g).connect(ctx.destination)
  src.start(now)

  return {
    stop(fadeSec = 2) {
      const t = ctx.currentTime
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec)
      try {
        src.stop(t + fadeSec + 0.05)
      } catch {
        /* already stopped */
      }
    },
    setVolume(v) {
      const t = ctx.currentTime
      g.gain.cancelScheduledValues(t)
      g.gain.linearRampToValueAtTime(Math.max(v, 0.0001), t + 0.3)
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Binaural fallback bed (only if the music file cannot load)         */
/* ------------------------------------------------------------------ */

export function startBed(ctx: AudioContext): BedNodes {
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(BED_GAIN, now + 4)
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
  return pool[0]
}

/* ------------------------------------------------------------------ */
/*  Mantra session (music bed + narration together)                    */
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

    // Establish the bed (real track, or binaural fallback), then let the
    // music breathe for a moment before the voice enters.
    this.initBed().then(() => {
      if (this.stopped) return
      setTimeout(() => this.speakNext(gender), VOICE_OFFSET * 1000)
    })
  }

  private async initBed() {
    if (!this.ctx) return
    try {
      const buffer = await decodeMusic(this.ctx)
      if (this.stopped || !this.ctx) return
      this.bed = startMusicBed(this.ctx, buffer)
    } catch {
      if (this.stopped || !this.ctx) return
      this.bed = startBed(this.ctx) // binaural fallback
    }
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
/*  Offline render — downloadable mix (music, + voice when available)  */
/* ------------------------------------------------------------------ */

/**
 * Render a downloadable WAV of the given duration.
 *  - The licensed music track is looped to fill the duration with gentle
 *    fade-in / fade-out.
 *  - If `voiceBuffer` is provided (from a TTS backend), it is overlaid on top
 *    and the music sits quietly beneath it; otherwise the music plays at a
 *    fuller standalone level.
 *
 * Falls back to a rendered binaural bed if the music track can't be decoded.
 */
export async function renderMix(
  durationSec: number,
  voiceBuffer: AudioBuffer | null = null,
): Promise<Blob> {
  const sampleRate = 44100
  const OAC = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
  const ctx: OfflineAudioContext = new OAC(2, Math.ceil(sampleRate * durationSec), sampleRate)

  const musicLevel = voiceBuffer ? MUSIC_UNDER_VOICE : MUSIC_SOLO

  let musicOk = true
  try {
    const music = await decodeMusic(ctx)
    const src = ctx.createBufferSource()
    src.buffer = music
    src.loop = true
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, 0)
    g.gain.exponentialRampToValueAtTime(musicLevel, 4)
    g.gain.setValueAtTime(musicLevel, Math.max(durationSec - 4, 4))
    g.gain.exponentialRampToValueAtTime(0.0001, durationSec)
    src.connect(g).connect(ctx.destination)
    src.start(0)
    src.stop(durationSec)
  } catch {
    musicOk = false
  }

  if (!musicOk) {
    renderBinauralInto(ctx, durationSec)
  }

  if (voiceBuffer) {
    const v = ctx.createBufferSource()
    v.buffer = voiceBuffer
    const vg = ctx.createGain()
    vg.gain.value = 1
    v.connect(vg).connect(ctx.destination)
    v.start(Math.min(VOICE_OFFSET, durationSec))
  }

  const buffer = await ctx.startRendering()
  return encodeWav(buffer)
}

/** Build the binaural bed inside an offline context (fallback for renderMix). */
function renderBinauralInto(ctx: OfflineAudioContext, durationSec: number) {
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, 0)
  master.gain.exponentialRampToValueAtTime(BED_GAIN, 4)
  master.gain.setValueAtTime(BED_GAIN, Math.max(durationSec - 4, 4))
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

  ;[left, right].forEach((o) => {
    o.start(0)
    o.stop(durationSec)
  })
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
