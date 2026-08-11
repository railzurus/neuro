<?php
/**
 * Письмо со ссылкой на заказ.
 *
 * Вложений нет — сервер не хранит MP3. В письме ссылка на страницу заказа,
 * где запись собирается заново (см. docs/payment-order-flow.md).
 *
 * Отправка идёт через SMTP с авторизацией под почтовым ящиком: только так
 * Beget подписывает письма DKIM-подписью без покупки выделенного IP, а без
 * подписи письма уходят в спам. Если реквизиты SMTP не заданы, используется
 * функция mail() — она работает, но письма не подписываются.
 */

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/db.php';

/** Кодирует заголовок письма в UTF-8 (RFC 2047). */
function mail_encode_header(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

/** Домен из адреса отправителя — нужен для Message-ID. */
function mail_sender_domain(string $from): string
{
    $at = strrpos($from, '@');
    return $at === false ? 'localhost' : substr($from, $at + 1);
}

/**
 * Ссылка на страницу заказа. Домен берём в punycode: кириллический URL в теле
 * письма спам-фильтры считают признаком фишинга, а часть почтовых клиентов
 * ещё и не превращает его в кликабельную ссылку.
 */
function mail_order_url(string $token): string
{
    $config = api_config();
    $base = trim((string) ($config['site_url_ascii'] ?? ''));
    if ($base === '') {
        $base = (string) ($config['site_url'] ?? '');
    }
    return rtrim($base, '/') . '/order/' . $token;
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
    $created = date('d.m.Y', strtotime((string) ($order['created_at'] ?? 'now')));

    // Письмо из четырёх строк и голой ссылки фильтры принимают за фишинг,
    // поэтому шлём две части: текстовую и HTML, обе с содержательным текстом.
    $boundary = 'b' . bin2hex(random_bytes(12));
    $message = mail_multipart(
        mail_order_text($url, $fromName, $created, $expires),
        mail_order_html($url, $fromName, $created, $expires),
        $boundary
    );

    // Message-ID и Date задаём сами — sendmail проставляет их не всегда,
    // а письмо без них теряет очки у почтовых фильтров.
    $messageId = '<' . bin2hex(random_bytes(16)) . '@' . mail_sender_domain($from) . '>';

    $headers = implode("\r\n", [
        'From: ' . mail_encode_header($fromName) . ' <' . $from . '>',
        'Reply-To: ' . $from,
        'Date: ' . date('r'),
        'Message-ID: ' . $messageId,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
    ]);

    $encodedSubject = mail_encode_header($subject);

    if (trim((string) ($config['smtp_host'] ?? '')) !== '') {
        $sent = mail_smtp_send($from, $to, $encodedSubject, $headers, $message);
    } else {
        // Запасной путь. -f задаёт конверт-отправителя: без него SPF не сходится.
        $sent = @mail($to, $encodedSubject, $message, $headers, '-f' . $from);
    }

    mail_log($order, $type, $sent ? 'sent' : 'failed');
    return (bool) $sent;
}

/** Собирает multipart/alternative из текстовой и HTML-части. */
function mail_multipart(string $text, string $html, string $boundary): string
{
    $part = function (string $type, string $content): string {
        return implode("\r\n", [
            'Content-Type: ' . $type . '; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($content), 76, "\r\n")),
        ]);
    };

    return implode("\r\n", [
        '--' . $boundary,
        $part('text/plain', $text),
        '--' . $boundary,
        $part('text/html', $html),
        '--' . $boundary . '--',
        '',
    ]);
}

/** Домен сайта для показа человеку — кириллицей, в отличие от ссылок. */
function mail_site_label(): string
{
    $config = api_config();
    $host = parse_url((string) ($config['site_url'] ?? ''), PHP_URL_HOST);
    return (string) ($host ?: 'медитациямечты.рф');
}

/** Текстовая часть письма. */
function mail_order_text(string $url, string $fromName, string $created, string $expires): string
{
    return implode("\r\n", [
        'Здравствуйте!',
        '',
        'Вы заказали персональную аудиозапись на сайте ' . mail_site_label() . '.',
        'Заказ от ' . $created . ' готов — скачать запись можно на этой странице:',
        '',
        $url,
        '',
        'Ссылка активна до ' . $expires . '. Скачивать можно сколько угодно раз,',
        'просто возвращайтесь по ней.',
        '',
        'Если ссылка не открывается или что-то пошло не так — ответьте на это',
        'письмо, разберёмся.',
        '',
        'Если письмо пришло вам по ошибке, просто удалите его.',
        '',
        '—',
        $fromName,
        mail_site_label(),
    ]);
}

/** HTML-часть письма. Картинок нет намеренно: у нового домена нет репутации. */
function mail_order_html(string $url, string $fromName, string $created, string $expires): string
{
    $e = function (string $value): string {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    };
    $site = $e(mail_site_label());
    $href = $e($url);

    return '<!DOCTYPE html>'
        . '<html lang="ru"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . $e($fromName) . '</title></head>'
        . '<body style="margin:0;padding:24px;background:#f6f5f2;'
        . 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
        . 'font-size:16px;line-height:1.6;color:#2b2b2b;">'
        . '<div style="max-width:520px;margin:0 auto;background:#ffffff;'
        . 'border-radius:12px;padding:32px;">'
        . '<p style="margin:0 0 16px;">Здравствуйте!</p>'
        . '<p style="margin:0 0 16px;">Вы заказали персональную аудиозапись на сайте '
        . $site . '. Заказ от ' . $e($created) . ' готов.</p>'
        . '<p style="margin:0 0 24px;"><a href="' . $href . '" '
        . 'style="display:inline-block;padding:12px 24px;background:#2b2b2b;'
        . 'color:#ffffff;text-decoration:none;border-radius:8px;">'
        . 'Скачать запись</a></p>'
        . '<p style="margin:0 0 16px;">Ссылка активна до ' . $e($expires) . '. '
        . 'Скачивать можно сколько угодно раз, просто возвращайтесь по ней.</p>'
        . '<p style="margin:0 0 16px;">Если кнопка не работает, откройте адрес вручную:<br>'
        . '<a href="' . $href . '" style="color:#6b6b6b;word-break:break-all;">'
        . $href . '</a></p>'
        . '<p style="margin:0 0 16px;">Если ссылка не открывается или что-то пошло не так — '
        . 'ответьте на это письмо, разберёмся.</p>'
        . '<p style="margin:0 0 24px;color:#6b6b6b;font-size:14px;">'
        . 'Если письмо пришло вам по ошибке, просто удалите его.</p>'
        . '<p style="margin:0;color:#6b6b6b;font-size:14px;">'
        . $e($fromName) . '<br>' . $site . '</p>'
        . '</div></body></html>';
}

/**
 * Читает ответ сервера. Многострочный ответ помечается дефисом на 4-й позиции,
 * последняя строка — пробелом. Возвращает [код, текст ответа].
 */
function smtp_read($fp): array
{
    $code = 0;
    $lines = [];
    while (($line = fgets($fp, 515)) !== false) {
        $lines[] = rtrim($line, "\r\n");
        $code = (int) substr($line, 0, 3);
        if (strlen($line) < 4 || $line[3] !== '-') {
            break;
        }
    }
    return [$code, implode(' | ', $lines)];
}

/**
 * Отправляет команду (пустая строка — только прочитать ответ) и сверяет код.
 */
function smtp_cmd($fp, string $command, int $expect): bool
{
    if ($command !== '') {
        fwrite($fp, $command . "\r\n");
    }
    [$code, $text] = smtp_read($fp);
    if ($code === $expect) {
        return true;
    }
    // Логин и пароль в лог не пишем — на этих шагах команда состоит из них.
    $safe = in_array($expect, [334, 235], true) ? '<credentials>' : $command;
    error_log('[mail] smtp: ' . $safe . ' -> ' . $text);
    return false;
}

/** Экранирует точку в начале строки — иначе она оборвёт передачу тела. */
function mail_dot_stuff(string $body): string
{
    return (string) preg_replace('/^\./m', '..', $body);
}

/**
 * Отправка через SMTP с авторизацией. Заголовки To и Subject добавляются
 * здесь: в отличие от mail(), сервер их сам не проставляет.
 */
function mail_smtp_send(string $from, string $to, string $subject, string $headers, string $body): bool
{
    $config = api_config();
    $host = trim((string) ($config['smtp_host'] ?? ''));
    $port = (int) ($config['smtp_port'] ?? 465);
    $user = trim((string) ($config['smtp_user'] ?? ''));
    $password = (string) ($config['smtp_password'] ?? '');

    $fp = @stream_socket_client($host . ':' . $port, $errno, $errstr, 20);
    if (!$fp) {
        error_log('[mail] smtp connect failed: ' . $errstr . ' (' . $errno . ')');
        return false;
    }
    stream_set_timeout($fp, 20);

    $ok = smtp_cmd($fp, '', 220)
        && smtp_cmd($fp, 'EHLO ' . mail_sender_domain($from), 250)
        && smtp_cmd($fp, 'AUTH LOGIN', 334)
        && smtp_cmd($fp, base64_encode($user), 334)
        && smtp_cmd($fp, base64_encode($password), 235)
        && smtp_cmd($fp, 'MAIL FROM:<' . $from . '>', 250)
        && smtp_cmd($fp, 'RCPT TO:<' . $to . '>', 250)
        && smtp_cmd($fp, 'DATA', 354);

    if ($ok) {
        fwrite($fp, 'To: ' . $to . "\r\n"
            . 'Subject: ' . $subject . "\r\n"
            . $headers . "\r\n\r\n"
            . mail_dot_stuff($body)
            . "\r\n.\r\n");
        $ok = smtp_cmd($fp, '', 250);
    }

    @fwrite($fp, "QUIT\r\n");
    @fclose($fp);
    return $ok;
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
