/**
 * Создание готового MP3 из параметров заказа.
 *
 * Аудио целиком собирается в браузере: голос приходит кусками из api/tts.php,
 * микс с альфа-волнами и кодирование в MP3 делает renderMix. Сервер файл
 * не хранит — при повторном заходе на страницу заказа запись создаётся заново
 * из тех же параметров (см. docs/payment-order-flow.md).
 */
import { renderMix, synthesizeVoice } from './audio'
import { wordCount } from './refine'
import type { OrderParams } from './orders'

/** Темп чтения, слов в минуту — для оценки длины музыкальной подложки. */
const WPM = 85

/** Длина подложки, если голос синтезировать не удалось. */
function fallbackSeconds(text: string): number {
  const seconds = Math.max(Math.round((wordCount(text) / WPM) * 60), 60)
  return Math.max(seconds + 20, 180)
}

/** Собирает запись и отдаёт её как Blob. */
export async function renderMantra({
  finalText,
  voice,
  speed,
}: OrderParams): Promise<Blob> {
  const voiceBuffer = await synthesizeVoice(finalText, voice, speed)
  const duration = voiceBuffer ? voiceBuffer.duration + 8 : fallbackSeconds(finalText)
  return renderMix(duration, voiceBuffer)
}

/** Собирает запись и сразу сохраняет её файлом. */
export async function downloadMantra(params: OrderParams): Promise<void> {
  const blob = await renderMantra(params)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'жизнь-мечты-голос-и-музыка.mp3'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
