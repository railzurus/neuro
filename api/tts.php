<?php
/**
 * Yandex SpeechKit TTS proxy.
 *
 * Принимает POST JSON { text, gender, speed? } и возвращает синтезированный
 * голос в формате mp3. API-ключ и folderId читаются из config/secrets.php
 * (в git не коммитится). Ошибки отдаются как JSON — фронтенд в этом случае
 * откатывается на браузерный голос.
 */

header('X-Content-Type-Options: nosniff');

function fail(int $code, string $message, $detail = null): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message, 'detail' => $detail], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    fail(405, 'Method not allowed');
}

$configFile = __DIR__ . '/config/secrets.php';
if (!is_file($configFile)) {
    fail(503, 'TTS not configured'); // secrets.php ещё не загружен на сервер
}
$config = require $configFile;
// Обрезаем случайные пробелы/переводы строк/кавычки вокруг значений.
$apiKey = trim((string) ($config['speechkit_api_key'] ?? ''), " \t\n\r\0\x0B\"'");
$folderId = trim((string) ($config['folder_id'] ?? ''), " \t\n\r\0\x0B\"'");
if ($apiKey === '' || $folderId === '' || strpos($apiKey, 'ВАШ') === 0) {
    fail(503, 'TTS not configured');
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    fail(400, 'Invalid JSON body');
}

$text = isset($body['text']) ? trim((string) $body['text']) : '';
if ($text === '') {
    fail(400, 'Empty text');
}
// v1 synthesize: не более 5000 символов и тела запроса ~15 КБ — держим запас.
if (mb_strlen($text) > 4500) {
    fail(413, 'Text too long for one request');
}

$gender = (($body['gender'] ?? 'female') === 'male') ? 'male' : 'female';
$voice = $gender === 'male' ? 'filipp' : 'alena';

$speed = isset($body['speed']) ? (float) $body['speed'] : 0.9;
$speed = max(0.1, min(3.0, $speed));

$post = http_build_query([
    'text' => $text,
    'lang' => 'ru-RU',
    'voice' => $voice,
    'speed' => $speed,
    'format' => 'mp3',
    'folderId' => $folderId,
]);

$ch = curl_init('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $post,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Api-Key ' . $apiKey,
        'Content-Type: application/x-www-form-urlencoded',
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
]);
$response = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
    fail(502, 'SpeechKit unreachable', $curlErr);
}
if ($status !== 200) {
    // SpeechKit вернул ошибку (текст обычно JSON) — пробрасываем как есть.
    fail($status ?: 502, 'SpeechKit error', $response);
}

header('Content-Type: audio/mpeg');
header('Content-Length: ' . strlen($response));
header('Cache-Control: no-store');
echo $response;
