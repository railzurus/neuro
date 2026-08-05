/**
 * Заказы: обращение к серверному API (api/order-*.php).
 *
 * Источник правды — сервер. Заказ переживает закрытие вкладки, смену
 * устройства и сбой сети, ссылка приходит письмом (docs/payment-order-flow.md).
 *
 * Локальная разработка: PHP под Vite не выполняется, поэтому в dev-режиме
 * при недоступном API используется заглушка на localStorage. В production-сборке
 * заглушки нет — ошибка API видна пользователю, чтобы «оплатил, но заказ
 * не сохранился» не прошло незамеченным.
 */

/** Стоимость услуги, ₽ (зафиксирована в Пользовательском соглашении). */
export const PRICE_RUB = 499

/** Сколько дней живёт ссылка на заказ (сервер — источник правды). */
export const ORDER_TTL_DAYS = 14

/** Параметры генерации — то, из чего заново создаётся запись. */
export interface OrderParams {
  finalText: string
  voice: string
  speed: number
}

export interface Order {
  token: string
  status: 'pending' | 'paid' | 'canceled' | 'refunded'
  amount: number
  currency: string
  email: string
  /** null, если заказ не оплачен или срок ссылки истёк. */
  params: OrderParams | null
  expiresAt: string
  expired: boolean
}

export interface CreatedOrder {
  token: string
  status: Order['status']
  orderUrl: string
  /** Ссылка на оплату в ЮKassa. Пока оплата не подключена — null. */
  confirmationUrl: string | null
}

const DEV = import.meta.env.DEV

/** Ошибка, которую можно показать пользователю. */
export class OrderError extends Error {}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new OrderError((data && data.error) || 'Ошибка сервера')
  }
  // Ответ не JSON (в dev так отвечает Vite, на бою — фатальная ошибка PHP,
  // отдающая HTML со статусом 200). Успехом это считать нельзя.
  if (!data || typeof data !== 'object') {
    throw new OrderError('Сервер вернул неожиданный ответ')
  }
  return data as T
}

/** Создаёт заказ — POST /api/order-create.php */
export async function createOrder(
  params: OrderParams,
  email: string,
): Promise<CreatedOrder> {
  try {
    return await postJson<CreatedOrder>('/api/order-create.php', {
      params,
      email,
      consent: true,
    })
  } catch (e) {
    if (DEV) return devStub.create(params, email)
    throw e instanceof OrderError
      ? e
      : new OrderError('Не удалось создать заказ. Проверьте соединение.')
  }
}

/** Загружает заказ — GET /api/order.php */
export async function getOrder(token: string): Promise<Order | null> {
  try {
    const res = await fetch(`/api/order.php?token=${encodeURIComponent(token)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new OrderError('Ошибка сервера')
    return (await res.json()) as Order
  } catch (e) {
    if (DEV) return devStub.get(token)
    throw e instanceof OrderError
      ? e
      : new OrderError('Не удалось загрузить заказ. Проверьте соединение.')
  }
}

/**
 * Отправляет ссылку на заказ письмом — POST /api/order-email.php
 * Если передан email — сначала меняет адрес доставки.
 */
export async function sendOrderLink(
  token: string,
  email?: string,
): Promise<string> {
  try {
    const data = await postJson<{ email: string }>('/api/order-email.php', {
      token,
      ...(email ? { email } : {}),
    })
    return data.email
  } catch (e) {
    if (DEV) return devStub.send(token, email)
    throw e instanceof OrderError
      ? e
      : new OrderError('Не удалось отправить письмо. Попробуйте позже.')
  }
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

/* ------------------------------------------------------------------ */
/* Заглушка для локальной разработки (только при import.meta.env.DEV)  */
/* ------------------------------------------------------------------ */

const DEV_KEY = 'dream-life-orders-dev'

const devStub = {
  readAll(): Record<string, Order> {
    try {
      return JSON.parse(localStorage.getItem(DEV_KEY) || '{}')
    } catch {
      return {}
    }
  },
  writeAll(all: Record<string, Order>) {
    localStorage.setItem(DEV_KEY, JSON.stringify(all))
  },
  create(params: OrderParams, email: string): CreatedOrder {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    const expires = new Date(Date.now() + ORDER_TTL_DAYS * 86400000)
    const order: Order = {
      token,
      status: 'paid',
      amount: PRICE_RUB,
      currency: 'RUB',
      email,
      params,
      expiresAt: expires.toISOString(),
      expired: false,
    }
    const all = devStub.readAll()
    all[token] = order
    devStub.writeAll(all)
    console.info('[orders] dev-заглушка: заказ создан локально', token.slice(0, 8))
    return { token, status: 'paid', orderUrl: `/order/${token}`, confirmationUrl: null }
  },
  get(token: string): Order | null {
    const order = devStub.readAll()[token]
    if (!order) return null
    const expired = new Date(order.expiresAt).getTime() < Date.now()
    return expired ? { ...order, expired: true, params: null } : order
  },
  send(token: string, email?: string): string {
    const all = devStub.readAll()
    const order = all[token]
    if (order && email) {
      order.email = email
      devStub.writeAll(all)
    }
    console.info('[orders] dev-заглушка: письмо не отправлено')
    return order ? order.email : (email ?? '')
  },
}
