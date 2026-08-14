<?php
/**
 * Общие помощники для JSON-эндпоинтов заказов.
 *
 * tts.php и refine.php намеренно не трогаем — они работают и имеют
 * собственные обработчики ошибок.
 */

// Всё время в проекте — UTC. Иначе gmdate() при записи и strtotime() при чтении
// разойдутся на смещение таймзоны сервера, и срок жизни ссылки уедет.
date_default_timezone_set('UTC');

/** Отдаёт JSON-ошибку и завершает выполнение. */
function api_fail(int $code, string $message, $detail = null): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => $message, 'detail' => $detail], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Отдаёт успешный JSON и завершает выполнение. */
function api_ok(array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Требует конкретный HTTP-метод. */
function api_require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        api_fail(405, 'Method not allowed');
    }
}

/** Читает и разбирает JSON-тело запроса. */
function api_json_body(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        api_fail(400, 'Invalid JSON body');
    }
    return $body;
}

/** Загружает config/secrets.php. */
function api_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $file = __DIR__ . '/../config/secrets.php';
    if (!is_file($file)) {
        api_fail(503, 'Service not configured');
    }
    $loaded = require $file;
    if (!is_array($loaded)) {
        api_fail(503, 'Service not configured');
    }
    $config = $loaded;
    return $config;
}

/** Проверка адреса — от опечаток, не от злого умысла. */
function api_valid_email(string $email): bool
{
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

/** Приватный, локальный или просто невалидный адрес — то есть не публичный. */
function api_ip_is_local(string $ip): bool
{
    return filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) === false;
}

/**
 * IP клиента. Используется как ключ ограничения частоты обращений к платным
 * API, поэтому подделка ключа = обход лимита.
 *
 * Заголовкам X-Real-IP и X-Forwarded-For верим только если запрос пришёл от
 * локального прокси (Beget проксирует, и REMOTE_ADDR тогда его собственный).
 * Если REMOTE_ADDR публичный — значит запрос пришёл к нам напрямую, и любые
 * заголовки в нём выставил сам клиент: раньше мы читали их первыми, и скрипт
 * со случайным X-Real-IP в каждом запросе обнулял счётчик на каждом вызове.
 *
 * Из X-Forwarded-For берём последний элемент, а не первый: цепочка идёт от
 * клиента к нам, начало подставляет клиент, конец — наш собственный прокси.
 */
function api_client_ip(): string
{
    $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));

    if ($remote !== '' && !api_ip_is_local($remote)) {
        return substr($remote, 0, 45);
    }

    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        return substr(trim((string) $_SERVER['HTTP_X_REAL_IP']), 0, 45);
    }

    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
        $last = trim((string) end($parts));
        if ($last !== '') {
            return substr($last, 0, 45);
        }
    }

    return substr($remote, 0, 45);
}
