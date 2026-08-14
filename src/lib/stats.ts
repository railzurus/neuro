/**
 * Счётчик созданных медитаций для главной страницы.
 *
 * Число приходит с сервера (api/stats.php). Если API недоступно — возвращаем
 * null, и счётчик просто не отображается: это украшение, ради него незачем
 * показывать пользователю ошибку.
 *
 * Локальная разработка: PHP под Vite не выполняется, поэтому в dev-режиме
 * подставляется правдоподобное число — иначе счётчик не проверить.
 */

const DEV = import.meta.env.DEV

export async function getCreatedCount(): Promise<number | null> {
  try {
    const res = await fetch('/api/stats.php')
    if (!res.ok) throw new Error('bad status')
    const data = await res.json()
    if (typeof data?.count !== 'number') throw new Error('bad payload')
    return data.count
  } catch {
    return DEV ? 903 : null
  }
}
