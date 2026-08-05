<?php
/**
 * Получение заказа по токену.
 *
 * GET ?token=<64 hex>
 * Ответ { token, status, amount, currency, email, params|null, expiresAt, expired }
 *
 * Параметры генерации отдаются только по оплаченному и не истёкшему заказу —
 * по ним браузер собирает запись заново.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/orders.php';

api_require_method('GET');

$token = (string) ($_GET['token'] ?? '');
$order = order_find($token);

if (!$order) {
    api_fail(404, 'Order not found');
}

api_ok(order_public($order));
