<?php
/**
 * Досверка «зависших» заказов: если HTTP-уведомление ЮKassa не дошло
 * (сервер лежал, отвалилась сеть), человек всё равно получит запись.
 *
 * Берём заказы в статусе pending с известным payment_id за последние
 * трое суток и спрашиваем у кассы их актуальный статус.
 *
 * Запуск (Beget → «Планировщик задач», раз в 15–30 минут):
 *   php /home/<логин>/<домен>/public_html/api/cron/reconcile.php
 * Либо по HTTP:
 *   https://медитациямечты.рф/api/cron/reconcile.php?token=<cron_token>
 *
 * При запуске из консоли токен не нужен.
 */

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/orders.php';
require_once __DIR__ . '/../lib/yookassa.php';

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    $config = api_config();
    $expected = (string) ($config['cron_token'] ?? '');
    $given = (string) ($_GET['token'] ?? '');
    if ($expected === '' || strpos($expected, 'ПРИДУМАЙТЕ') === 0 || !hash_equals($expected, $given)) {
        api_fail(403, 'Forbidden');
    }
}

$since = gmdate('Y-m-d H:i:s', time() - 3 * 86400);

$stmt = db()->prepare(
    'SELECT * FROM orders
      WHERE status = ?
        AND payment_id IS NOT NULL
        AND created_at > ?
      ORDER BY id
      LIMIT 100'
);
$stmt->execute(['pending', $since]);
$orders = $stmt->fetchAll();

$paid = 0;
$canceled = 0;
$failed = 0;

foreach ($orders as $order) {
    try {
        $payment = yk_get_payment((string) $order['payment_id']);
    } catch (RuntimeException $e) {
        error_log('[reconcile] ' . $e->getMessage());
        $failed++;
        continue;
    }

    if ($payment === null) {
        continue;
    }

    $status = (string) ($payment['status'] ?? '');

    if ($status === 'succeeded' && !empty($payment['paid'])) {
        $paidValue = (float) ($payment['amount']['value'] ?? 0);
        if (abs($paidValue - (float) $order['amount']) > 0.01) {
            error_log('[reconcile] amount mismatch for order ' . $order['id']);
            continue;
        }
        order_mark_paid($order, (string) $order['payment_id']);
        $paid++;
    } elseif ($status === 'canceled') {
        order_mark_canceled($order, (string) $order['payment_id']);
        $canceled++;
    }
}

$message = 'checked ' . count($orders) . ', paid ' . $paid . ', canceled ' . $canceled . ', failed ' . $failed;

if ($isCli) {
    echo $message . PHP_EOL;
} else {
    api_ok(['ok' => true, 'checked' => count($orders), 'paid' => $paid, 'canceled' => $canceled, 'failed' => $failed]);
}
