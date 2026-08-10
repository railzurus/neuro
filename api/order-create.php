<?php
/**
 * Создание заказа.
 *
 * POST JSON { params: { finalText, voice, speed }, email, consent: true }
 * Ответ    { token, status, orderUrl, confirmationUrl|null }
 *
 * payments_enabled = true  — создаётся платёж в ЮKassa, заказ остаётся
 *   в статусе pending, фронтенд уводит человека на confirmationUrl.
 *   В paid заказ переводит api/yookassa-webhook.php (подстраховка —
 *   api/cron/reconcile.php).
 * payments_enabled = false — режим без оплаты: заказ сразу помечается
 *   оплаченным и на почту уходит ссылка.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/orders.php';
require_once __DIR__ . '/lib/yookassa.php';

api_require_method('POST');

$body = api_json_body();

$email = trim((string) ($body['email'] ?? ''));
if (!api_valid_email($email)) {
    api_fail(400, 'Invalid email');
}
if (empty($body['consent'])) {
    api_fail(400, 'Consent required');
}

$params = order_validate_params($body['params'] ?? null);

$config = api_config();
$now = time();

$token = order_make_token();
$createdAt = gmdate('Y-m-d H:i:s', $now);
$expiresAt = gmdate('Y-m-d H:i:s', $now + ORDER_TTL_DAYS * 24 * 60 * 60);

$pdo = db();

try {
    $stmt = $pdo->prepare(
        'INSERT INTO orders
            (token, status, amount, currency, email, params_json, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $token,
        'pending',
        ORDER_PRICE_RUB,
        'RUB',
        $email,
        json_encode($params, JSON_UNESCAPED_UNICODE),
        $createdAt,
        $expiresAt,
    ]);
    $orderId = (int) $pdo->lastInsertId();

    // Журнал согласия — доказательство по ч. 3 ст. 9 152-ФЗ.
    $consent = $pdo->prepare(
        'INSERT INTO consents (order_id, email, doc_versions, accepted_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $consent->execute([
        $orderId,
        $email,
        json_encode(ORDER_DOC_VERSIONS, JSON_UNESCAPED_UNICODE),
        $createdAt,
        api_client_ip(),
        substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500),
    ]);
} catch (PDOException $e) {
    error_log('[order-create] ' . $e->getMessage());
    api_fail(503, 'Could not create order');
}

$order = order_find($token);
if (!$order) {
    api_fail(503, 'Could not create order');
}

$confirmationUrl = null;

if (empty($config['payments_enabled'])) {
    // Режим без оплаты: сразу выдаём заказ и отправляем письмо.
    $order = order_mark_paid($order);
} else {
    // site_url_ascii — запасной вариант, если на хостинге нет расширения intl
    // и кириллический домен некому перевести в punycode.
    $siteUrl = rtrim((string) ($config['site_url_ascii'] ?? $config['site_url'] ?? ''), '/');
    $returnUrl = yk_ascii_url($siteUrl . '/order/' . $token);

    try {
        $payment = yk_create_payment(
            $token,
            $email,
            (float) ORDER_PRICE_RUB,
            $returnUrl,
            ORDER_ITEM_NAME
        );
    } catch (RuntimeException $e) {
        error_log('[order-create] ' . $e->getMessage());
        // Заказ без платежа только мешает: закрываем его сразу.
        order_mark_canceled($order);
        api_fail(502, 'Не удалось перейти к оплате. Попробуйте ещё раз.');
    }

    try {
        $upd = $pdo->prepare('UPDATE orders SET payment_id = ? WHERE id = ?');
        $upd->execute([(string) $payment['id'], $order['id']]);
    } catch (PDOException $e) {
        // Не критично: webhook найдёт заказ по metadata.order_token.
        error_log('[order-create] payment_id not saved: ' . $e->getMessage());
    }

    $confirmationUrl = $payment['confirmation']['confirmation_url'] ?? null;
    if (!$confirmationUrl) {
        error_log('[order-create] no confirmation_url in payment ' . $payment['id']);
        api_fail(502, 'Не удалось перейти к оплате. Попробуйте ещё раз.');
    }
}

api_ok([
    'token' => $order['token'],
    'status' => $order['status'],
    'orderUrl' => '/order/' . $order['token'],
    'confirmationUrl' => $confirmationUrl,
]);
