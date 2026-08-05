<?php
/**
 * Очистка просроченных заказов: обнуляет params_json (текст истории — ПДн)
 * у заказов, у которых истёк срок ссылки. Сама запись о платеже остаётся —
 * она нужна для учёта.
 *
 * Запуск:
 *   - из панели Beget («Планировщик задач», раз в сутки):
 *       php /home/<логин>/медитациямечты.рф/public_html/api/cron/cleanup.php
 *   - либо по HTTP, если удобнее:
 *       https://медитациямечты.рф/api/cron/cleanup.php?token=<cron_token>
 *
 * При запуске из консоли токен не нужен.
 */

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/db.php';

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    $config = api_config();
    $expected = (string) ($config['cron_token'] ?? '');
    $given = (string) ($_GET['token'] ?? '');
    if ($expected === '' || strpos($expected, 'ПРИДУМАЙТЕ') === 0 || !hash_equals($expected, $given)) {
        api_fail(403, 'Forbidden');
    }
}

$stmt = db()->prepare(
    'UPDATE orders
        SET params_json = NULL, params_purged_at = ?
      WHERE expires_at < ?
        AND params_json IS NOT NULL'
);
$stmt->execute([db_now(), db_now()]);
$purged = $stmt->rowCount();

$message = 'purged ' . $purged . ' order(s)';

if ($isCli) {
    echo $message . PHP_EOL;
} else {
    api_ok(['ok' => true, 'purged' => $purged]);
}
