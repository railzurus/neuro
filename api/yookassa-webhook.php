<?php
/**
 * Приём HTTP-уведомлений ЮKassa.
 *
 * Адрес для кабинета (Интеграция → HTTP-уведомления):
 *   https://медитациямечты.рф/api/yookassa-webhook.php
 * События: payment.succeeded, payment.canceled, refund.succeeded.
 *
 * Правила, на которых всё держится:
 *  - телу уведомления НЕ доверяем: статус платежа всегда перепроверяем
 *    запросом в API кассы по id;
 *  - обработка идемпотентна — повторное уведомление не отправит письмо дважды
 *    (см. order_mark_paid);
 *  - на успешно обработанное уведомление отвечаем 200, иначе касса будет
 *    повторять его сутки. При временном сбое (БД, сеть) отвечаем 5xx
 *    СПЕЦИАЛЬНО — чтобы повтор случился.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/orders.php';
require_once __DIR__ . '/lib/yookassa.php';

api_require_method('POST');

$config = api_config();
$ip = api_client_ip();

// Проверка источника. Даже если её обойти, статус всё равно перепроверяется
// в API кассы, а «зависшие» заказы подберёт api/cron/reconcile.php.
if (($config['yookassa_verify_ip'] ?? true) && !yk_ip_allowed($ip)) {
    error_log('[yookassa-webhook] rejected IP ' . $ip);
    api_fail(403, 'Forbidden');
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    api_fail(400, 'Invalid JSON body');
}

$event = (string) ($body['event'] ?? '');
$object = is_array($body['object'] ?? null) ? $body['object'] : [];

// У возврата object — это объект возврата, id платежа лежит отдельным полем.
$paymentId = $event === 'refund.succeeded'
    ? (string) ($object['payment_id'] ?? '')
    : (string) ($object['id'] ?? '');

if ($paymentId === '') {
    error_log('[yookassa-webhook] no payment id, event=' . $event);
    api_ok(['ok' => true, 'skipped' => 'no payment id']);
}

try {
    $payment = yk_get_payment($paymentId);
} catch (RuntimeException $e) {
    // Касса недоступна — просим повторить уведомление позже.
    error_log('[yookassa-webhook] ' . $e->getMessage());
    api_fail(503, 'Verification failed');
}

if ($payment === null) {
    error_log('[yookassa-webhook] payment not found: ' . $paymentId);
    api_ok(['ok' => true, 'skipped' => 'payment not found']);
}

$order = order_find_by_payment($paymentId);
if (!$order) {
    // payment_id мог не записаться при создании заказа — ищем по metadata.
    $token = (string) ($payment['metadata']['order_token'] ?? '');
    if ($token !== '') {
        $order = order_find($token);
    }
}

if (!$order) {
    error_log('[yookassa-webhook] no order for payment ' . $paymentId);
    api_ok(['ok' => true, 'skipped' => 'order not found']);
}

$status = (string) ($payment['status'] ?? '');

if ($status === 'succeeded' && !empty($payment['paid'])) {
    // Сверяем сумму: платёж на другую сумму выдачей считать нельзя.
    $paidValue = (float) ($payment['amount']['value'] ?? 0);
    if (abs($paidValue - (float) $order['amount']) > 0.01) {
        error_log('[yookassa-webhook] amount mismatch for ' . $paymentId . ': ' . $paidValue);
        api_ok(['ok' => true, 'skipped' => 'amount mismatch']);
    }
    order_mark_paid($order, $paymentId);
} elseif ($status === 'canceled') {
    order_mark_canceled($order, $paymentId);
}

if ($event === 'refund.succeeded') {
    try {
        $upd = db()->prepare('UPDATE orders SET status = ? WHERE id = ?');
        $upd->execute(['refunded', $order['id']]);
    } catch (PDOException $e) {
        error_log('[yookassa-webhook] refund update failed: ' . $e->getMessage());
        api_fail(503, 'Update failed');
    }
}

api_ok(['ok' => true]);
