<?php
/**
 * Письмо со ссылкой на заказ.
 *
 * Вложений нет — сервер не хранит MP3. В письме ссылка на страницу заказа,
 * где запись собирается заново (см. docs/payment-order-flow.md).
 *
 * Отправка через функцию mail() — на Beget она работает, если адрес
 * отправителя принадлежит ящику на этом же домене.
 */

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/db.php';

/** Кодирует заголовок письма в UTF-8 (RFC 2047). */
function mail_encode_header(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

/** Ссылка на страницу заказа. */
function mail_order_url(string $token): string
{
    $config = api_config();
    $base = rtrim((string) ($config['site_url'] ?? ''), '/');
    return $base . '/order/' . $token;
}

/**
 * Отправляет письмо со ссылкой на заказ.
 * $type: 'delivery' (первое письмо) или 'resend' (повторное).
 * Возвращает true при успехе.
 */
function mail_send_order_link(array $order, string $type = 'delivery'): bool
{
    $config = api_config();
    $from = trim((string) ($config['mail_from'] ?? ''));
    $fromName = (string) ($config['mail_from_name'] ?? 'Медитация мечты');
    $to = (string) $order['email'];
    $url = mail_order_url((string) $order['token']);

    if ($from === '' || !api_valid_email($to)) {
        mail_log($order, $type, 'failed');
        return false;
    }

    $subject = $type === 'resend'
        ? 'Ваша запись — ссылка на скачивание'
        : 'Ваша запись готова';

    $expires = date('d.m.Y', strtotime((string) $order['expires_at']));

    $lines = [
        'Здравствуйте!',
        '',
        'Ваша запись готова. Скачать её можно на этой странице:',
        $url,
        '',
        'Ссылка активна до ' . $expires . '. Скачивать можно сколько угодно раз —',
        'просто возвращайтесь по ней.',
        '',
        'Если письмо пришло вам по ошибке, просто удалите его.',
        '',
        '—',
        $fromName,
    ];
    $message = implode("\r\n", $lines);

    $headers = implode("\r\n", [
        'From: ' . mail_encode_header($fromName) . ' <' . $from . '>',
        'Reply-To: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ]);

    // -f задаёт конверт-отправителя: без него письма чаще уходят в спам.
    $sent = @mail($to, mail_encode_header($subject), $message, $headers, '-f' . $from);

    mail_log($order, $type, $sent ? 'sent' : 'failed');
    return (bool) $sent;
}

/** Пишет отправку в журнал (нужен для антиабьюза и разбора жалоб). */
function mail_log(array $order, string $type, string $status): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO email_log (order_id, email, type, status, sent_at)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $order['id'],
            $order['email'],
            $type,
            $status,
            db_now(),
        ]);
    } catch (PDOException $e) {
        error_log('[mail] log failed: ' . $e->getMessage());
    }
}

/** Сколько писем по заказу отправлено за последний час. */
function mail_sent_last_hour(int $orderId): int
{
    $stmt = db()->prepare(
        'SELECT COUNT(*) FROM email_log
         WHERE order_id = ? AND sent_at > ?'
    );
    $stmt->execute([$orderId, gmdate('Y-m-d H:i:s', time() - 3600)]);
    return (int) $stmt->fetchColumn();
}
