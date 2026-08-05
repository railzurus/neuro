<?php
/**
 * Создание заказа.
 *
 * POST JSON { params: { finalText, voice, speed }, email, consent: true }
 * Ответ    { token, status, orderUrl, confirmationUrl|null }
 *
 * Пока payments_enabled = false (ЮKassa не подключена) заказ сразу помечается
 * оплаченным и на почту уходит ссылка. Когда касса появится:
 *   1) выставить payments_enabled = true в config/secrets.php;
 *   2) здесь, после вставки заказа, создать платёж в ЮKassa
 *      (с заголовком Idempotence-Key) и вернуть confirmationUrl;
 *   3) в paid заказ будет переводить api/yookassa-webhook.php.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/orders.php';

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
    // TODO(ЮKassa): создать платёж и положить сюда confirmation_url.
    api_fail(501, 'Payments are enabled but not implemented yet');
}

api_ok([
    'token' => $order['token'],
    'status' => $order['status'],
    'orderUrl' => '/order/' . $order['token'],
    'confirmationUrl' => $confirmationUrl,
]);
