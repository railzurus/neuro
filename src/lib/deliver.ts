/**
 * Создание готового MP3 из параметров заказа.
 *
 * Аудио целиком собирается в браузере: голос приходит кусками из api/tts.php,
 * микс с альфа-волнами и кодирование в MP3 делает renderMix. Сервер файл
 * не хранит — при повторном заходе на страницу заказа запись создаётся заново
 * из тех же параметров (см. docs/payment-order-flow.md).
 *
 * Пересборка стоит денег (обращение к SpeechKit), поэтому:
 *  1) готовый файл кладём в кэш браузера — повторные скачивания на том же
 *     устройстве бесплатны и мгновенны;
 *  2) если в кэше нет, перед синтезом отмечаемся в api/order-download.php,
 *     который считает пересборки и не даёт выйти за лимит.
 */
import { renderMix, synthesizeVoice } from './audio'
import { wordCount } from './refine'
import { OrderError, type OrderParams } from './orders'

/** Темп чтения, слов в минуту — для оценки длины музыкальной подложки. */
const WPM = 85

const CACHE_NAME = 'mantra-audio-v1'
const FILE_NAME = 'жизнь-мечты-голос-и-музыка.mp3'

/** Длина подложки, если голос синтезировать не удалось. */
function fallbackSeconds(text: string): number {
  const seconds = Math.max(Math.round((wordCount(text) / WPM) * 60), 60)
  return Math.max(seconds + 20, 180)
}

/** Ключ кэша для заказа. Параметры заказа неизменны, поэтому токена достаточно. */
function cacheKey(token: string): string {
  return `/mantra-cache/${token}`
}

async function readCache(token: string): Promise<Blob | null> {
  if (!('caches' in window)) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(cacheKey(token))
    return hit ? await hit.blob() : null
  } catch {
    return null // приватный режим или нет места — просто соберём заново
  }
}

async function writeCache(token: string, blob: Blob): Promise<void> {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(cacheKey(token), new Response(blob))
  } catch {
    /* не смогли закэшировать — не страшно */
  }
}

/** Отмечает пересборку на сервере. Бросает OrderError, если лимит исчерпан. */
async function claimRender(token: string): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/order-download.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  } catch {
    if (import.meta.env.DEV) return // локально PHP не выполняется
    throw new OrderError('Нет связи с сервером. Попробуйте ещё раз.')
  }

  if (res.ok) return

  if (res.status === 429) {
    throw new OrderError(
      'Достигнут предел пересборок записи. Скачанный ранее файл остаётся у вас — ' +
        'если он потерялся, напишите нам на ceo@zurus.tech.',
    )
  }
  if (import.meta.env.DEV) return // в dev эндпоинта нет — не мешаем разработке
  throw new OrderError('Не удалось начать сборку записи.')
}

/**
 * Собирает запись и отдаёт её как Blob.
 * С токеном заказа использует кэш и учитывает лимит пересборок.
 */
export async function renderMantra(
  { finalText, voice, speed }: OrderParams,
  orderToken?: string,
): Promise<Blob> {
  if (orderToken) {
    const cached = await readCache(orderToken)
    if (cached) return cached
    await claimRender(orderToken)
  }

  const voiceBuffer = await synthesizeVoice(finalText, voice, speed, orderToken)
  const duration = voiceBuffer ? voiceBuffer.duration + 8 : fallbackSeconds(finalText)
  const blob = await renderMix(duration, voiceBuffer)

  if (orderToken) await writeCache(orderToken, blob)
  return blob
}

/** Собирает запись и сразу сохраняет её файлом. */
export async function downloadMantra(
  params: OrderParams,
  orderToken?: string,
): Promise<void> {
  const blob = await renderMantra(params, orderToken)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
