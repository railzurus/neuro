<?php
/**
 * Подключение к MySQL. Реквизиты — в config/secrets.php.
 * Схема таблиц: api/schema.sql
 */

require_once __DIR__ . '/http.php';

/**
 * Возвращает подключение PDO или завершает запрос ошибкой 503.
 * Для мест, где сбой БД не должен ронять запрос, есть db_try().
 */
function db(): PDO
{
    try {
        return db_connect();
    } catch (RuntimeException $e) {
        // Текст ошибки может содержать реквизиты — наружу его не отдаём.
        error_log('[db] ' . $e->getMessage());
        api_fail(503, $e->getCode() === 1 ? 'Database not configured' : 'Database unavailable');
    }
}

/** То же, но при сбое возвращает null вместо завершения запроса. */
function db_try(): ?PDO
{
    try {
        return db_connect();
    } catch (RuntimeException $e) {
        error_log('[db] ' . $e->getMessage());
        return null;
    }
}

/** Создаёт подключение (один раз за запрос). Бросает RuntimeException при сбое. */
function db_connect(): PDO
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
        throw new RuntimeException('not configured', 1);
    }

    $dsn = 'mysql:host=' . $host . ';dbname=' . $name . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        throw new RuntimeException('connection failed: ' . $e->getMessage(), 2);
    }

    return $pdo;
}

/** Текущее время в формате MySQL DATETIME. */
function db_now(): string
{
    return gmdate('Y-m-d H:i:s');
}
