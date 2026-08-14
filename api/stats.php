<?php
/**
 * Счётчик созданных медитаций для главной страницы.
 *
 * GET → { "count": N }
 *
 * N = COUNTER_BASE + число оплаченных заказов в базе.
 *
 * Считаем именно оплаченные: строка заказа появляется в момент нажатия
 * «Купить», и незавершённые попытки в счётчик попадать не должны. Строки
 * заказов не удаляются никогда (cron обнуляет только текст истории,
 * см. api/cron/cleanup.php), поэтому счётчик не откатывается назад.
 */

header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';

/** С какого числа начинается счётчик. */
const COUNTER_BASE = 887;

api_require_method('GET');

// Счётчик — украшение, ронять из-за него страницу незачем. Поэтому db_try(),
// а не db(): последняя при сбое подключения завершает запрос ошибкой 503.
$count = 0;
$pdo = db_try();
if ($pdo !== null) {
    try {
        $count = (int) $pdo
            ->query("SELECT COUNT(*) FROM orders WHERE status = 'paid'")
            ->fetchColumn();
    } catch (PDOException $e) {
        error_log('[stats] ' . $e->getMessage());
    }
}

// Пять минут кэша: цифра меняется редко, а запрос идёт с каждой загрузки
// главной. Свой заголовок, а не api_ok(), — тот проставляет no-store.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');
echo json_encode(['count' => COUNTER_BASE + $count]);
