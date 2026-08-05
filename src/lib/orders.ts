/**
 * Модель заказа и её временное хранилище.
 *
 * СТАТУС: заглушка. Заказы лежат в localStorage браузера.
 * Когда появится backend (см. docs/payment-order-flow.md), эти функции
 * заменяются вызовами api/order-create.php, api/order.php, api/order-email.php —
 * поля Order намеренно повторяют схему таблицы `orders`, чтобы замена была точечной.
 *
 * Ограничение заглушки: заказ живёт только в этом браузере. Настоящая защита
 * «оплатил, но не скачал» появится вместе с серверным хранением.
 */

/** Стоимость услуги, ₽ (зафиксирована в Пользовательском соглашении). */
export const PRICE_RUB = 499

/** Сколько дней живёт ссылка на заказ (см. раздел retention в ТЗ). */
export const ORDER_TTL_DAYS = 14

const STORAGE_KEY = 'dream-life-orders'

/** Параметры генерации — то, из чего заново создаётся запись. */
export interface OrderParams {
  finalText: string
  voice: string
  speed: number
}

export interface Order {
  token: string
  status: 'pending' | 'paid'
  amount: number
  currency: 'RUB'
  email: string
  /** Содержит текст пользователя — ПДн. Обнуляется по истечении срока. */
  params: OrderParams | null
  createdAt: string
  paidAt: string | null
  expiresAt: string
}

type OrderMap = Record<string, Order>

function readAll(): OrderMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OrderMap) : {}
  } catch {
    return {}
  }
}

function writeAll(orders: OrderMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch {
    /* приватный режим — заказ просто не сохранится */
  }
}

/** Неугадываемый идентификатор заказа (на сервере — bin2hex(random_bytes(32))). */
function makeToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Создаёт заказ в статусе pending — аналог POST /api/order-create.php. */
export function createOrder(params: OrderParams, email: string): Order {
  const now = new Date()
  const expires = new Date(now.getTime() + ORDER_TTL_DAYS * 24 * 60 * 60 * 1000)
  const order: Order = {
    token: makeToken(),
    status: 'pending',
    amount: PRICE_RUB,
    currency: 'RUB',
    email,
    params,
    createdAt: now.toISOString(),
    paidAt: null,
    expiresAt: expires.toISOString(),
  }
  const all = readAll()
  all[order.token] = order
  writeAll(all)
  return order
}

/**
 * Отмечает заказ оплаченным.
 *
 * На бою это делает api/yookassa-webhook.php после проверки платежа —
 * фронтенд сам никогда не должен переводить заказ в paid.
 */
export function markPaid(token: string): Order | null {
  const all = readAll()
  const order = all[token]
  if (!order) return null
  order.status = 'paid'
  order.paidAt = new Date().toISOString()
  writeAll(all)
  return order
}

/** Аналог GET /api/order.php?token=… */
export function getOrder(token: string): Order | null {
  const order = readAll()[token]
  if (!order) return null
  // Срок вышел — параметры считаются удалёнными (на сервере это делает cron).
  if (isExpired(order) && order.params) {
    return { ...order, params: null }
  }
  return order
}

export function isExpired(order: Order): boolean {
  return new Date(order.expiresAt).getTime() < Date.now()
}

/** Смена адреса доставки — аналог POST /api/order-email.php */
export function setOrderEmail(token: string, email: string): Order | null {
  const all = readAll()
  const order = all[token]
  if (!order) return null
  order.email = email
  writeAll(all)
  return order
}

/** Простая проверка адреса — от опечаток, не от злого умысла. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
