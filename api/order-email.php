<?php
/**
 * Переотправка ссылки на заказ и смена адреса доставки.
 *
 * POST JSON { token, email? }
 *   - без email  — отправить ссылку на текущий адрес заказа;
 *   - с email    — сменить адрес и отправить на новый.
 * Ответ { ok: true, email }
 *
 * Ограничение частоты: не больше MAX_PER_HOUR писем на заказ в час,
 * чтобы сервис нельзя было использовать как рассыльщик.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/orders.php';
require_once __DIR__ . '/lib/mail.php';

const MAX_PER_HOUR = 5;

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

if (mail_sent_last_hour((int) $order['id']) >= MAX_PER_HOUR) {
    api_fail(429, 'Too many emails, try later');
}

// Смена адреса, если он передан и отличается от текущего.
if (isset($body['email'])) {
    $email = trim((string) $body['email']);
    if (!api_valid_email($email)) {
        api_fail(400, 'Invalid email');
    }
    if ($email !== $order['email']) {
        $stmt = db()->prepare('UPDATE orders SET email = ? WHERE id = ?');
        $stmt->execute([$email, $order['id']]);
        $order['email'] = $email;
    }
}

if (!mail_send_order_link($order, 'resend')) {
    api_fail(502, 'Could not send email');
}

$upd = db()->prepare('UPDATE orders SET delivered_at = ? WHERE id = ?');
$upd->execute([db_now(), $order['id']]);

api_ok(['ok' => true, 'email' => $order['email']]);
