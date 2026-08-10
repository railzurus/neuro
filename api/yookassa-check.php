<?php
/**
 * Самопроверка подключения ЮKassa. Нужна, когда оплата не запускается,
 * а лога ошибок под рукой нет: показывает, что именно не сходится.
 *
 * Запуск (токен тот же, что у cron-скриптов, из config/secrets.php):
 *   https://медитациямечты.рф/api/yookassa-check.php?token=<cron_token>
 *
 * Секреты наружу не отдаются — только длина и префикс ключа.
 * Проверка «пробный платёж» создаёт в кассе неоплаченный платёж:
 * он никуда не денется из списка, но денег не двигает и сам протухнет.
 * Отключается параметром &payment=0.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/orders.php';
require_once __DIR__ . '/lib/yookassa.php';

$config = api_config();
$expected = (string) ($config['cron_token'] ?? '');
$given = (string) ($_GET['token'] ?? '');
if ($expected === '' || strpos($expected, 'ПРИДУМАЙТЕ') === 0 || !hash_equals($expected, $given)) {
    api_fail(403, 'Forbidden');
}

$shopId = trim((string) ($config['yookassa_shop_id'] ?? ''));
$secret = trim((string) ($config['yookassa_secret_key'] ?? ''));

$kind = 'не заполнен';
if ($secret !== '') {
    if (strpos($secret, 'test_') === 0) {
        $kind = 'тестовый (test_)';
    } elseif (strpos($secret, 'live_') === 0) {
        $kind = 'боевой (live_)';
    } else {
        $kind = 'неизвестный префикс: ' . substr($secret, 0, 5) . '…';
    }
}

$siteUrl = rtrim((string) ($config['site_url_ascii'] ?? $config['site_url'] ?? ''), '/');
$returnUrl = yk_ascii_url($siteUrl . '/order/' . str_repeat('0', 64));

$out = [
    'payments_enabled' => (bool) ($config['payments_enabled'] ?? false),
    'shop_id' => $shopId === '' ? 'НЕ ЗАПОЛНЕН' : $shopId,
    'secret_key' => $kind . ', длина ' . strlen($secret),
    'receipt_enabled' => (bool) ($config['yookassa_receipt'] ?? true),
    'vat_code' => (int) ($config['yookassa_vat_code'] ?? 1),
    'ext_curl' => function_exists('curl_init'),
    'ext_intl' => function_exists('idn_to_ascii'),
    'return_url' => $returnUrl,
    'return_url_ascii' => (bool) preg_match('/^[\x20-\x7E]+$/', $returnUrl),
];

// 1. Проверка авторизации — запрос, который ничего не создаёт.
try {
    $res = yk_request('GET', '/payments?limit=1');
    $out['auth'] = $res['status'] === 200
        ? 'ok'
        : ('HTTP ' . $res['status'] . ': ' . json_encode($res['body'], JSON_UNESCAPED_UNICODE));
} catch (RuntimeException $e) {
    $out['auth'] = 'ошибка связи: ' . $e->getMessage();
}

// 2. Пробное создание платежа — ровно тот же запрос, что делает order-create.php.
if (($_GET['payment'] ?? '1') !== '0' && $out['auth'] === 'ok') {
    $body = yk_payment_body(
        bin2hex(random_bytes(32)),
        'test@example.com',
        (float) ORDER_PRICE_RUB,
        $returnUrl,
        ORDER_ITEM_NAME
    );
    try {
        $res = yk_request('POST', '/payments', $body, bin2hex(random_bytes(16)));
        if ($res['status'] === 200) {
            $out['payment'] = 'ok, id ' . ($res['body']['id'] ?? '?')
                . ', confirmation_url ' . (empty($res['body']['confirmation']['confirmation_url']) ? 'НЕТ' : 'есть');
        } else {
            $out['payment'] = 'HTTP ' . $res['status'] . ': ' . json_encode($res['body'], JSON_UNESCAPED_UNICODE);
            $out['payment_request'] = $body;
        }
    } catch (RuntimeException $e) {
        $out['payment'] = 'ошибка связи: ' . $e->getMessage();
    }
}

api_ok($out);
