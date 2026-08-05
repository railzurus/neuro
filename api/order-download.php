<?php
/**
 * Учёт пересборок записи.
 *
 * POST JSON { token }
 * Ответ    { ok: true, used, limit, remaining }
 *
 * Фронтенд вызывает это ПЕРЕД синтезом — но только если записи нет в кэше
 * браузера. Скачивание из кэша ничего не стоит и в счёт не идёт.
 *
 * Зачем: файл на сервере не хранится, поэтому каждая пересборка заново
 * обращается к платному SpeechKit. Лимит защищает от бесконечных пересборок
 * в течение 14 дней жизни ссылки.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/orders.php';

api_require_method('POST');

$body = api_json_body();

$order = order_find((string) ($body['token'] ?? ''));
if (!$order) {
    api_fail(404, 'Order not found');
}
if ($order['status'] !== 'paid') {
    api_fail(409, 'Order is not paid');
}
if (order_is_expired($order)) {
    api_fail(410, 'Order link expired');
}

$used = (int) $order['download_count'];
if ($used >= ORDER_DOWNLOAD_LIMIT) {
    api_fail(429, 'Download limit reached');
}

$stmt = db()->prepare(
    'UPDATE orders SET download_count = download_count + 1
      WHERE id = ? AND download_count < ?'
);
$stmt->execute([$order['id'], ORDER_DOWNLOAD_LIMIT]);

if ($stmt->rowCount() === 0) {
    // Кто-то опередил параллельным запросом и выбрал остаток.
    api_fail(429, 'Download limit reached');
}

$used++;

api_ok([
    'ok' => true,
    'used' => $used,
    'limit' => ORDER_DOWNLOAD_LIMIT,
    'remaining' => ORDER_DOWNLOAD_LIMIT - $used,
]);
