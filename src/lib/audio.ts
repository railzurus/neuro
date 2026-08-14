import { Mp3Encoder } from '@breezystack/lamejs'
import { prepareForTts } from './refine'

/**
 * Audio engine for the dream-life mantra.
 *
 *  - Music bed: a ready-made, licensed alpha/theta ambient track
 *    (`/music/alpha-tide.mp3`) is loaded, decoded, looped and played quietly
 *    under the voice. If it fails to load, we fall back to a live binaural
 *    beat (~10 Hz) generated with the Web Audio API — so there is always a bed.
 *  - Voice: synthesized by Yandex SpeechKit through `api/tts.php` and decoded
 *    into an AudioBuffer.
 *  - Mixing: live playback mixes voice + music through the Web Audio graph;
 *    downloads are rendered offline — no server or ffmpeg required.
 *
 * Запасного голоса нет намеренно. Раньше при сбое синтеза включался браузерный
 * SpeechSynthesis, и человек вместо купленной записи слышал роботизированное
 * чтение — то есть плохой результат выдавался за нормальный. Теперь сбой
 * синтеза виден как ошибка: лучше попросить повторить попытку, чем отдать
 * заведомо негодное аудио.
 */

const MUSIC_URL = '/music/alpha-tide.mp3'
/**
 * Music level under the voice (0..1). With the browser SpeechSynthesis voice
 * (which plays at full OS volume in a separate channel) the bed has to sit
 * higher to be audible at all. Will be re-balanced lower once the voice comes
 * from SpeakKit inside the same Web Audio graph.
 */
const MUSIC_UNDER_VOICE = 0.42
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
  g.gain.exponentialRampToValueAtTime(gain, now + 2)
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
/*  Mantra session (music bed + narration together)                    */
/* ------------------------------------------------------------------ */

export interface SessionCallbacks {
  /** Fired while the voice is being synthesized (network) before playback. */
  onPreparing?: () => void
  /** Fired the moment audio actually starts. */
  onReady?: () => void
  onProgress?: (fraction: number) => void
  onEnd?: () => void
  /** Синтез не удался. Воспроизведения не будет — показать ошибку. */
  onError?: (message: string) => void
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ------------------------------------------------------------------ */
/*  SpeakKit voice synthesis (real TTS → audio buffer)                 */
/* ------------------------------------------------------------------ */

const TTS_URL = '/api/tts.php'
/** Max characters per SpeechKit request (limit is 5000; keep a safe margin). */
const CHUNK_LIMIT = 2200
/** Silence inserted between synthesized chunks so phrases don't run together. */
const CHUNK_GAP = 0.35

const voiceBufferCache = new Map<string, AudioBuffer>()

/** Целевая длина бесплатного превью в словах (~15 с при ≈85 слов/мин). */
const PREVIEW_TARGET_WORDS = 20

/**
 * Жёсткий предел по словам: набор идёт целыми предложениями, поэтому одно
 * длинное предложение иначе растянуло бы превью далеко за 15 секунд.
 */
const PREVIEW_MAX_WORDS = 24

/**
 * Страховка по символам. Сервер разрешает анонимный синтез только короткого
 * текста (см. tts.php), а если пользователь пишет без точек, весь текст
 * считается одним предложением.
 */
const PREVIEW_MAX_CHARS = 400

/** Обрезает текст до N слов. */
function limitWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  return words.length <= max ? text : words.slice(0, max).join(' ')
}

/** Обрезает текст до N символов по границе слова. */
function limitChars(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
}

/**
 * Первые целые предложения — короткое бесплатное превью на сайте (~15 с).
 * Полный текст озвучивается только в оплаченном заказе.
 */
export function previewText(full: string, targetWords = PREVIEW_TARGET_WORDS): string {
  const sentences = splitSentences(full)
  let result: string

  if (!sentences.length) {
    result = full.trim()
  } else {
    const out: string[] = []
    let words = 0
    for (const s of sentences) {
      out.push(s)
      words += s.split(/\s+/).filter(Boolean).length
      if (words >= targetWords) break
    }
    result = out.join(' ')
  }

  return limitChars(limitWords(result, PREVIEW_MAX_WORDS), PREVIEW_MAX_CHARS)
}

/** Split text into request-sized chunks on sentence boundaries. */
function chunkText(text: string, limit = CHUNK_LIMIT): string[] {
  const sentences = splitSentences(text)
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if (s.length > limit) {
      if (cur) {
        chunks.push(cur)
        cur = ''
      }
      for (let i = 0; i < s.length; i += limit) chunks.push(s.slice(i, i + limit))
      continue
    }
    if ((cur ? cur.length + 1 : 0) + s.length > limit) {
      if (cur) chunks.push(cur)
      cur = s
    } else {
      cur = cur ? cur + ' ' + s : s
    }
  }
  if (cur) chunks.push(cur)
  return chunks
}

async function ttsChunk(
  ctx: BaseAudioContext,
  text: string,
  voice: string,
  speed: number,
  orderToken?: string,
): Promise<AudioBuffer> {
  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Без токена сервер синтезирует только короткое превью — полная длина
    // доступна лишь по оплаченному заказу (см. api/tts.php).
    body: JSON.stringify({ text, voice, speed, ...(orderToken ? { orderToken } : {}) }),
  })
  if (!res.ok) throw new Error(`tts ${res.status}`)
  const bytes = await res.arrayBuffer()
  return ctx.decodeAudioData(bytes)
}

/** Concatenate buffers back-to-back with a short gap between them. */
function concatBuffers(ctx: BaseAudioContext, buffers: AudioBuffer[], gapSec: number): AudioBuffer {
  const sr = buffers[0].sampleRate
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels))
  const gap = Math.floor(gapSec * sr)
  const total = buffers.reduce((n, b) => n + b.length, 0) + gap * (buffers.length - 1)
  const out = ctx.createBuffer(channels, total, sr)
  for (let c = 0; c < channels; c++) {
    const data = out.getChannelData(c)
    let offset = 0
    buffers.forEach((b, i) => {
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1))
      data.set(src, offset)
      offset += b.length + (i < buffers.length - 1 ? gap : 0)
    })
  }
  return out
}

/** Сбой синтеза. Текст сообщения предназначен пользователю. */
export class VoiceError extends Error {}

/**
 * Synthesize the whole text into one voice AudioBuffer via the SpeakKit proxy.
 *
 * Бросает VoiceError при любом сбое: ключ не настроен, сеть, таймаут, отказ
 * декодирования. Раньше здесь возвращался null, и вызывающий код молча
 * подставлял браузерный голос или собирал запись вообще без голоса —
 * пользователь получал негодный результат вместо честной ошибки.
 *
 * Перед синтезом текст проходит техническую подготовку (`prepareForTts`):
 * ударения, числа прописью, разбивка на фразы и разметка пауз. Наружу этот
 * вариант не отдаётся — кэш и вызывающий код работают с текстом пользователя.
 */
export async function synthesizeVoice(
  text: string,
  voice: string,
  speed: number,
  orderToken?: string,
): Promise<AudioBuffer> {
  const key = voice + '@' + speed + '::' + text
  const cached = voiceBufferCache.get(key)
  if (cached) return cached

  let chunks: string[]
  try {
    chunks = chunkText(await prepareForTts(text))
  } catch (e) {
    console.warn('[synthesizeVoice] подготовка текста не удалась:', e)
    throw new VoiceError('Не удалось подготовить текст к озвучке. Попробуйте ещё раз.')
  }

  if (!chunks.length) {
    throw new VoiceError('Текст пустой — озвучивать нечего.')
  }

  try {
    // Decode with an OfflineAudioContext: it doesn't count against the live
    // AudioContext limit and isn't affected by autoplay suspension, so it's
    // far more reliable than spinning up a real AudioContext per synthesis.
    const OAC = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
    const ctx: BaseAudioContext = new OAC(2, 1, 44100)
    const buffers: AudioBuffer[] = []
    for (const c of chunks) buffers.push(await ttsChunk(ctx, c, voice, speed, orderToken))
    const merged = buffers.length === 1 ? buffers[0] : concatBuffers(ctx, buffers, CHUNK_GAP)
    voiceBufferCache.set(key, merged)
    return merged
  } catch (e) {
    console.warn('[synthesizeVoice] синтез не удался:', e)
    throw new VoiceError(
      'Не удалось синтезировать голос. Такое бывает при перебоях у провайдера — ' +
        'попробуйте ещё раз через минуту.',
    )
  }
}

export class MantraSession {
  private ctx: AudioContext | null = null
  private bed: BedNodes | null = null
  private voiceSrc: AudioBufferSourceNode | null = null
  private progressTimer: ReturnType<typeof setInterval> | null = null
  private stopped = false
  private cb: SessionCallbacks = {}

  get isActive() {
    return this.ctx !== null && !this.stopped
  }

  start(text: string, voice: string, speed: number, cb: SessionCallbacks = {}) {
    this.stop() // clean any previous run
    this.stopped = false
    this.cb = cb

    const AC = window.AudioContext || (window as any).webkitAudioContext
    this.ctx = new AC()

    // Голос только из SpeechKit. Не получилось — сообщаем об ошибке и молчим:
    // запасного голоса нет намеренно, см. комментарий в шапке файла.
    this.cb.onPreparing?.()
    synthesizeVoice(text, voice, speed)
      .then(async (voiceBuffer) => {
        if (this.stopped || !this.ctx) return
        await this.initBed()
        if (this.stopped || !this.ctx) return
        this.playBuffer(voiceBuffer)
      })
      .catch((e: unknown) => {
        if (this.stopped) return
        const message =
          e instanceof VoiceError
            ? e.message
            : 'Не удалось воспроизвести запись. Попробуйте ещё раз через минуту.'
        this.stop()
        this.cb.onError?.(message)
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

  /** Play a synthesized voice buffer over the music bed (real mix). */
  private playBuffer(buffer: AudioBuffer) {
    if (!this.ctx) return
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.ctx.destination)
    this.voiceSrc = src
    const startAt = this.ctx.currentTime + VOICE_OFFSET
    src.start(startAt)
    this.cb.onReady?.()
    const dur = buffer.duration
    this.progressTimer = setInterval(() => {
      if (this.stopped || !this.ctx) return
      const t = this.ctx.currentTime - startAt
      this.cb.onProgress?.(Math.max(0, Math.min(1, t / dur)))
    }, 250)
    src.onended = () => {
      if (this.stopped) return
      this.finish()
    }
  }

  private finish() {
    this.clearTimer()
    this.cb.onProgress?.(1)
    this.bed?.stop(3)
    this.cb.onEnd?.()
    this.releaseCtx(3500)
  }

  pause() {
    // Голос и музыка идут через один контекст, поэтому останавливается всё.
    this.ctx?.suspend()
  }

  resume() {
    this.ctx?.resume()
  }

  stop() {
    this.stopped = true
    this.clearTimer()
    try {
      this.voiceSrc?.stop()
    } catch {
      /* already stopped */
    }
    this.voiceSrc = null
    this.bed?.stop(0.4)
    this.bed = null
    this.releaseCtx(500)
  }

  private clearTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer)
      this.progressTimer = null
    }
  }

  /**
   * Detach the current AudioContext immediately, then close it after a delay
   * (to let fades finish). Capturing the context in a local means a later
   * start() that creates a fresh context is never nulled by this timer.
   */
  private releaseCtx(delayMs: number) {
    const ctx = this.ctx
    this.ctx = null
    if (ctx) {
      setTimeout(() => {
        if (ctx.state !== 'closed') ctx.close().catch(() => {})
      }, delayMs)
    }
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
  return encodeMp3(buffer)
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

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/**
 * Encode a rendered AudioBuffer to an MP3 Blob (lamejs). Runs in ~1152-sample
 * blocks and yields to the event loop periodically so the UI stays responsive
 * during a multi-minute render.
 */
async function encodeMp3(buffer: AudioBuffer, kbps = 128): Promise<Blob> {
  const channels = Math.min(buffer.numberOfChannels, 2)
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps)
  const left = floatTo16(buffer.getChannelData(0))
  const right = channels > 1 ? floatTo16(buffer.getChannelData(1)) : null

  const blockSize = 1152
  const chunks: Uint8Array[] = []
  let processed = 0
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize)
    const enc = right
      ? encoder.encodeBuffer(l, right.subarray(i, i + blockSize))
      : encoder.encodeBuffer(l)
    if (enc.length > 0) chunks.push(enc)
    if (++processed % 100 === 0) await new Promise((r) => setTimeout(r))
  }
  const tail = encoder.flush()
  if (tail.length > 0) chunks.push(tail)

  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' })
}
