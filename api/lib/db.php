<?php
/**
 * Подключение к MySQL. Реквизиты — в config/secrets.php.
 * Схема таблиц: api/schema.sql
 */

require_once __DIR__ . '/http.php';

/** Возвращает единое подключение PDO (создаётся один раз за запрос). */
function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $config = api_config();
    $host = (string) ($config['db_host'] ?? 'localhost');
    $name = (string) ($config['db_name'] ?? '');
    $user = (string) ($config['db_user'] ?? '');
    $password = (string) ($config['db_password'] ?? '');

    if ($name === '' || $user === '' || strpos($name, 'ВАШ') === 0) {
        api_fail(503, 'Database not configured');
    }

    $dsn = 'mysql:host=' . $host . ';dbname=' . $name . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        // Текст ошибки может содержать реквизиты — наружу его не отдаём.
        error_log('[db] connection failed: ' . $e->getMessage());
        api_fail(503, 'Database unavailable');
    }

    return $pdo;
}

/** Текущее время в формате MySQL DATETIME. */
function db_now(): string
{
    return gmdate('Y-m-d H:i:s');
}
