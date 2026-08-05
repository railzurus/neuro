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

/** IP клиента (Beget проксирует, поэтому смотрим и заголовки). */
function api_client_ip(): string
{
    foreach (['HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $value = explode(',', (string) $_SERVER[$key])[0];
            return substr(trim($value), 0, 45);
        }
    }
    return '';
}
