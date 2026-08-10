<?php
/**
 * Интеграция с ЮKassa (API v3, https://yookassa.ru/developers/api).
 *
 * Авторизация — Basic: shopId в качестве логина, секретный ключ в качестве
 * пароля. Тестовый и боевой магазины отличаются только этой парой реквизитов
 * (у тестового секретный ключ начинается с `test_`), код одинаковый.
 *
 * Карта вводится на стороне ЮKassa: мы создаём платёж, уводим человека
 * на confirmation_url и ждём HTTP-уведомление.
 */

require_once __DIR__ . '/http.php';

/** Базовый адрес API. */
const YK_API = 'https://api.yookassa.ru/v3';

/**
 * Реквизиты магазина из config/secrets.php.
 * Бросает RuntimeException, если оплата включена, но реквизиты не заполнены.
 */
function yk_credentials(): array
{
    $config = api_config();
    $shopId = trim((string) ($config['yookassa_shop_id'] ?? ''));
    $secret = trim((string) ($config['yookassa_secret_key'] ?? ''));

    if ($shopId === '' || $secret === '' || strpos($shopId, 'ВАШ') === 0) {
        throw new RuntimeException('YooKassa credentials are not configured');
    }

    return [$shopId, $secret];
}

/** Тестовый ли магазин. Нужно только для диагностики и баннера в письме. */
function yk_is_test(): bool
{
    $config = api_config();
    return strpos((string) ($config['yookassa_secret_key'] ?? ''), 'test_') === 0;
}

/**
 * Запрос к API кассы.
 *
 * @param string      $method         GET|POST
 * @param string      $path           например '/payments'
 * @param array|null  $body           тело запроса (для POST)
 * @param string|null $idempotenceKey обязателен для POST: повторный запрос
 *                                    с тем же ключом не создаст второй платёж
 * @return array{status:int,body:array}
 * @throws RuntimeException при сетевой ошибке или нечитаемом ответе
 */
function yk_request(string $method, string $path, ?array $body = null, ?string $idempotenceKey = null): array
{
    [$shopId, $secret] = yk_credentials();

    $headers = ['Content-Type: application/json'];
    if ($idempotenceKey !== null) {
        $headers[] = 'Idempotence-Key: ' . $idempotenceKey;
    }

    $ch = curl_init(YK_API . $path);
    $options = [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_USERPWD => $shopId . ':' . $secret,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
    ];
    if ($body !== null) {
        $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
    }
    curl_setopt_array($ch, $options);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        throw new RuntimeException('YooKassa unreachable: ' . $curlErr);
    }

    $decoded = json_decode((string) $response, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('YooKassa returned non-JSON (HTTP ' . $status . ')');
    }

    return ['status' => $status, 'body' => $decoded];
}

/**
 * Создаёт платёж и возвращает объект платежа ЮKassa.
 *
 * Ключ идемпотентности — токен заказа: если ответ кассы потерялся по дороге
 * и запрос повторили, второй платёж по тому же заказу не появится.
 *
 * @throws RuntimeException
 */
function yk_create_payment(string $orderToken, string $email, float $amount, string $returnUrl, string $description): array
{
    $payment = yk_payment_body($orderToken, $email, $amount, $returnUrl, $description);

    $res = yk_request('POST', '/payments', $payment, $orderToken);

    if ($res['status'] !== 200 || empty($res['body']['id'])) {
        $detail = $res['body']['description'] ?? ($res['body']['code'] ?? 'unknown');
        throw new RuntimeException('YooKassa refused payment (HTTP ' . $res['status'] . '): ' . $detail);
    }

    return $res['body'];
}

/**
 * Тело запроса на создание платежа.
 * Вынесено отдельно, чтобы api/yookassa-check.php мог отправить ровно тот же
 * запрос и показать сырой ответ кассы.
 */
function yk_payment_body(string $orderToken, string $email, float $amount, string $returnUrl, string $description): array
{
    $value = number_format($amount, 2, '.', '');

    $payment = [
        'amount' => ['value' => $value, 'currency' => 'RUB'],
        // true — деньги списываются сразу, без двухстадийности.
        'capture' => true,
        'confirmation' => [
            'type' => 'redirect',
            'return_url' => $returnUrl,
        ],
        'description' => mb_substr($description, 0, 128),
        // По metadata webhook находит заказ, даже если payment_id не успел записаться.
        'metadata' => ['order_token' => $orderToken],
    ];

    $receipt = yk_receipt($email, $value, $description);
    if ($receipt !== null) {
        $payment['receipt'] = $receipt;
    }

    return $payment;
}

/**
 * Данные чека по 54-ФЗ.
 *
 * У магазина подключены «Чеки от ЮKassa»: касса формирует и отправляет чек
 * в ФНС и покупателю по данным, которые мы передаём вместе с платежом.
 * Поэтому receipt — обязательная часть запроса, а не опция.
 *
 * Возвращает null только если чеки отключены (yookassa_receipt => false),
 * например при переходе на стороннюю кассу со сценарием
 * «сначала платёж, потом чек».
 */
function yk_receipt(string $email, string $value, string $description): ?array
{
    $config = api_config();
    if (!($config['yookassa_receipt'] ?? true)) {
        return null;
    }

    $receipt = [
        'customer' => ['email' => $email],
        'items' => [[
            'description' => mb_substr($description, 0, 128),
            'quantity' => '1.00',
            'amount' => ['value' => $value, 'currency' => 'RUB'],
            // Ставка НДС: 1 — без НДС. Сверить с бухгалтером.
            'vat_code' => (int) ($config['yookassa_vat_code'] ?? 1),
            'payment_subject' => (string) ($config['yookassa_payment_subject'] ?? 'service'),
            'payment_mode' => (string) ($config['yookassa_payment_mode'] ?? 'full_prepayment'),
        ]],
    ];

    // Нужен, только если у организации в кассе заведено больше одной
    // системы налогообложения. Иначе ЮKassa подставит единственную сама.
    $taxSystem = (int) ($config['yookassa_tax_system_code'] ?? 0);
    if ($taxSystem > 0) {
        $receipt['tax_system_code'] = $taxSystem;
    }

    return $receipt;
}

/**
 * Запрашивает актуальное состояние платежа.
 * Телу уведомления не доверяем — статус всегда перепроверяем этим запросом.
 *
 * @return array|null объект платежа либо null, если платёж не найден
 * @throws RuntimeException
 */
function yk_get_payment(string $paymentId): ?array
{
    if (!preg_match('/^[0-9a-zA-Z\-]{1,64}$/', $paymentId)) {
        return null;
    }

    $res = yk_request('GET', '/payments/' . rawurlencode($paymentId));

    if ($res['status'] === 404) {
        return null;
    }
    if ($res['status'] !== 200) {
        throw new RuntimeException('YooKassa payment lookup failed (HTTP ' . $res['status'] . ')');
    }

    return $res['body'];
}

/**
 * Приводит адрес к ASCII: кириллический домен медитациямечты.рф касса
 * в return_url не примет, нужен punycode (xn--…).
 */
function yk_ascii_url(string $url): string
{
    $parts = parse_url($url);
    if (empty($parts['host'])) {
        return $url;
    }

    $host = $parts['host'];
    if (function_exists('idn_to_ascii')) {
        $ascii = idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
        if (is_string($ascii) && $ascii !== '') {
            $host = $ascii;
        }
    }

    $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : 'https://';
    $port = isset($parts['port']) ? ':' . $parts['port'] : '';
    $path = $parts['path'] ?? '';

    return $scheme . $host . $port . $path;
}

/**
 * Пришло ли уведомление с IP-адресов ЮKassa.
 * Список: https://yookassa.ru/developers/using-api/webhooks
 */
function yk_ip_allowed(string $ip): bool
{
    $ranges = [
        '185.71.76.0/27',
        '185.71.77.0/27',
        '77.75.153.0/25',
        '77.75.154.128/25',
        '77.75.156.11/32',
        '77.75.156.35/32',
        '2a02:5180::/32',
    ];

    foreach ($ranges as $range) {
        if (yk_ip_in_range($ip, $range)) {
            return true;
        }
    }
    return false;
}

/** Проверка «IP входит в подсеть» для IPv4 и IPv6. */
function yk_ip_in_range(string $ip, string $cidr): bool
{
    [$subnet, $bits] = array_pad(explode('/', $cidr, 2), 2, null);

    $addr = @inet_pton($ip);
    $net = @inet_pton($subnet);
    if ($addr === false || $net === false || strlen($addr) !== strlen($net)) {
        return false;
    }

    $bits = (int) $bits;
    $bytes = intdiv($bits, 8);
    $rest = $bits % 8;

    if ($bytes > 0 && strncmp($addr, $net, $bytes) !== 0) {
        return false;
    }
    if ($rest === 0) {
        return true;
    }

    $mask = chr((0xFF << (8 - $rest)) & 0xFF);
    return (($addr[$bytes] & $mask) === ($net[$bytes] & $mask));
}
