<?php
/**
 * Общая логика заказов: константы, поиск, приведение к виду для фронтенда.
 */

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/db.php';

/** Стоимость услуги, ₽ (зафиксирована в Пользовательском соглашении). */
const ORDER_PRICE_RUB = 499;

/** Сколько дней живёт ссылка на заказ. */
const ORDER_TTL_DAYS = 14;

/**
 * Наименование услуги: видно в описании платежа и в чеке (54-ФЗ).
 * Ограничение ЮKassa — 128 символов.
 */
const ORDER_ITEM_NAME = 'Персональная аудиозапись «Медитация мечты»';

/** Ограничение на длину истории — защита от мусора в базе. */
const ORDER_MAX_TEXT_LEN = 20000;

/**
 * Сколько раз можно пересобрать запись по одному заказу.
 * Файл не хранится, каждая пересборка — платный синтез, поэтому нужен предел.
 */
const ORDER_DOWNLOAD_LIMIT = 10;

/**
 * Редакции юридических документов. Фиксируются в журнале согласий,
 * чтобы потом было видно, с какой версией человек согласился.
 * При правке документов — обновить даты здесь.
 */
const ORDER_DOC_VERSIONS = [
    'privacy' => '2026-08-03',
    'terms' => '2026-08-03',
    'consent' => '2026-08-03',
];

/** Неугадываемый идентификатор заказа. */
function order_make_token(): string
{
    return bin2hex(random_bytes(32));
}

/** Ищет заказ по токену. */
function order_find(string $token): ?array
{
    if (!preg_match('/^[0-9a-f]{64}$/', $token)) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM orders WHERE token = ? LIMIT 1');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** Ищет заказ по идентификатору платежа в ЮKassa. */
function order_find_by_payment(string $paymentId): ?array
{
    $stmt = db()->prepare('SELECT * FROM orders WHERE payment_id = ? LIMIT 1');
    $stmt->execute([$paymentId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** Истёк ли срок жизни ссылки. */
function order_is_expired(array $order): bool
{
    return strtotime((string) $order['expires_at']) < time();
}

/**
 * Приводит заказ к виду, который отдаём фронтенду.
 * Параметры отдаются только по оплаченному и не истёкшему заказу.
 */
function order_public(array $order): array
{
    $expired = order_is_expired($order);
    $paid = $order['status'] === 'paid';

    $params = null;
    if ($paid && !$expired && !empty($order['params_json'])) {
        $decoded = json_decode((string) $order['params_json'], true);
        if (is_array($decoded)) {
            $params = $decoded;
        }
    }

    return [
        'token' => $order['token'],
        'status' => $order['status'],
        'amount' => (float) $order['amount'],
        'currency' => $order['currency'],
        'email' => $order['email'],
        'params' => $params,
        'expiresAt' => gmdate('c', strtotime((string) $order['expires_at'])),
        'expired' => $expired,
        'downloadsUsed' => (int) $order['download_count'],
        'downloadLimit' => ORDER_DOWNLOAD_LIMIT,
    ];
}

/**
 * Проверяет параметры генерации из запроса.
 * Возвращает нормализованный массив либо завершает запрос ошибкой.
 */
function order_validate_params($raw): array
{
    if (!is_array($raw)) {
        api_fail(400, 'Missing params');
    }
    $text = trim((string) ($raw['finalText'] ?? ''));
    if ($text === '') {
        api_fail(400, 'Empty text');
    }
    if (mb_strlen($text) > ORDER_MAX_TEXT_LEN) {
        api_fail(413, 'Text too long');
    }
    $voice = (string) ($raw['voice'] ?? '');
    if (!preg_match('/^[a-z_]{1,32}$/', $voice)) {
        api_fail(400, 'Bad voice');
    }
    $speed = (float) ($raw['speed'] ?? 0.8);
    if ($speed < 0.1 || $speed > 3.0) {
        api_fail(400, 'Bad speed');
    }

    return ['finalText' => $text, 'voice' => $voice, 'speed' => $speed];
}

/**
 * Закрывает неоплаченный заказ. Оплаченный не трогает — на всякий случай,
 * чтобы гонка уведомлений не отменила выданный заказ.
 */
function order_mark_canceled(array $order, ?string $paymentId = null): void
{
    try {
        $stmt = db()->prepare(
            'UPDATE orders SET status = ?, payment_id = COALESCE(payment_id, ?)
              WHERE id = ? AND status = ?'
        );
        $stmt->execute(['canceled', $paymentId, $order['id'], 'pending']);
    } catch (PDOException $e) {
        error_log('[orders] cancel failed: ' . $e->getMessage());
    }
}

/**
 * Переводит заказ в статус «оплачен» и отправляет письмо со ссылкой.
 * Идемпотентна: повторный вызов не отправит письмо второй раз.
 *
 * На бою это вызывает webhook ЮKassa. Пока оплата не подключена —
 * вызывается сразу из order-create.php (см. payments_enabled).
 */
function order_mark_paid(array $order, ?string $paymentId = null): array
{
    if ($order['status'] === 'paid') {
        return $order;
    }

    $stmt = db()->prepare(
        'UPDATE orders SET status = ?, paid_at = ?, payment_id = ?
         WHERE id = ? AND status <> ?'
    );
    $stmt->execute(['paid', db_now(), $paymentId, $order['id'], 'paid']);

    // Другой параллельный запрос мог опередить — тогда письмо уже ушло.
    if ($stmt->rowCount() === 0) {
        $fresh = order_find((string) $order['token']);
        return $fresh ?: $order;
    }

    $order['status'] = 'paid';
    $order['paid_at'] = db_now();

    require_once __DIR__ . '/mail.php';
    if (mail_send_order_link($order, 'delivery')) {
        $upd = db()->prepare('UPDATE orders SET delivered_at = ? WHERE id = ?');
        $upd->execute([db_now(), $order['id']]);
        $order['delivered_at'] = db_now();
    }

    return $order;
}
