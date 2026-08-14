<?php
/**
 * Ограничение частоты обращений к платным API (SpeechKit, YandexGPT).
 *
 * Хранит отметки в таблице rate_limit. Старые записи вычищает cron.
 *
 * Поведение при недоступной БД — «пропускать» (fail-open): лучше пустить
 * лишний запрос, чем уронить озвучку на всём сайте. Проверка оплаченного
 * заказа устроена наоборот и при сбое БД запрещает — там на кону деньги.
 */

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/db.php';

/**
 * Регистрирует обращение и сообщает, укладывается ли оно в лимит.
 *
 * @param string $bucket  название лимита (tts_anon, tts_order, refine)
 * @param string $ident   кого считаем: IP или токен заказа
 * @param int    $max     сколько обращений разрешено в окне
 * @param int    $window  длина окна в секундах
 * @return bool true — можно продолжать; false — лимит исчерпан
 */
function rate_limit_allow(string $bucket, string $ident, int $max, int $window): bool
{
    if ($ident === '') {
        return true;
    }

    $pdo = db_try();
    if ($pdo === null) {
        return true; // fail-open, см. комментарий в шапке
    }

    try {
        $since = gmdate('Y-m-d H:i:s', time() - $window);

        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM rate_limit
              WHERE bucket = ? AND ident = ? AND hit_at > ?'
        );
        $stmt->execute([$bucket, $ident, $since]);

        if ((int) $stmt->fetchColumn() >= $max) {
            return false;
        }

        $ins = $pdo->prepare(
            'INSERT INTO rate_limit (bucket, ident, hit_at) VALUES (?, ?, ?)'
        );
        $ins->execute([$bucket, $ident, gmdate('Y-m-d H:i:s')]);

        return true;
    } catch (PDOException $e) {
        error_log('[ratelimit] ' . $e->getMessage());
        return true; // fail-open, см. комментарий в шапке
    }
}

/**
 * Общий потолок на весь сайт: сколько обращений в bucket сделали все вместе.
 *
 * Счёта по IP недостаточно: у нарушителя с набором прокси адреса честно
 * разные, и персональный лимит его не держит. Этот потолок ограничивает
 * стоимость худшего часа независимо от того, кто и откуда просит.
 *
 * Отметку не ставит — её ставит rate_limit_allow(), которую вызывают следом.
 *
 * @return bool true — можно продолжать; false — общий лимит исчерпан
 */
function rate_limit_total_allow(string $bucket, int $max, int $window): bool
{
    $pdo = db_try();
    if ($pdo === null) {
        return true; // fail-open, см. комментарий в шапке
    }

    try {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM rate_limit WHERE bucket = ? AND hit_at > ?'
        );
        $stmt->execute([$bucket, gmdate('Y-m-d H:i:s', time() - $window)]);
        $used = (int) $stmt->fetchColumn();

        if ($used >= $max) {
            // В лог обязательно: иначе упёршихся в потолок живых пользователей
            // не отличить от тишины, и предел останется занижённым навсегда.
            error_log("[ratelimit] общий потолок {$bucket}: {$used}/{$max} за {$window}с");
            return false;
        }

        return true;
    } catch (PDOException $e) {
        error_log('[ratelimit] ' . $e->getMessage());
        return true; // fail-open, см. комментарий в шапке
    }
}
