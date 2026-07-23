<?php
/**
 * Yandex SpeechKit TTS proxy (API v3).
 *
 * Принимает POST JSON { text, gender, speed? } и возвращает синтезированный
 * голос в формате mp3. Использует SpeechKit API v3 (utteranceSynthesis), который
 * авторизуется API-ключом со scope `yc.ai.foundationModels.execute` — тем же,
 * что и YandexGPT, поэтому достаточно одного ключа.
 *
 * Ключ и folderId читаются из config/secrets.php (в git не коммитится).
 * Ошибки отдаются как JSON — фронтенд тогда откатывается на браузерный голос.
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
    fail(503, 'TTS not configured');
}
$config = require $configFile;
$trimChars = " \t\n\r\0\x0B\"'";
// Годится любой ключ аккаунта (v3 работает и с foundationModels, и с speechkitTts).
$apiKey = trim((string) ($config['speechkit_api_key'] ?? ''), $trimChars);
if ($apiKey === '') {
    $apiKey = trim((string) ($config['gpt_api_key'] ?? ''), $trimChars);
}
$folderId = trim((string) ($config['folder_id'] ?? ''), $trimChars);
if ($apiKey === '' || $folderId === '' || strpos($apiKey, 'ВАШ') === 0) {
    fail(503, 'TTS not configured');
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    fail(400, 'Invalid JSON body');
}

// Диагностика: работает ли v1 с текущим ключом (после починки роли)?
if (!empty($body['debugV1'])) {
    $post = http_build_query([
        'text' => 'Проверка синтеза речи на версии один.',
        'lang' => 'ru-RU', 'voice' => 'alena', 'format' => 'mp3', 'folderId' => $folderId,
    ]);
    $c = curl_init('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize');
    curl_setopt_array($c, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $post, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Api-Key ' . $apiKey, 'Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 30,
    ]);
    $r = curl_exec($c); $st = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['v1_status' => $st, 'v1_is_audio' => ($r !== false && substr((string) $r, 0, 1) !== '{'), 'v1_head' => substr((string) $r, 0, 200)], JSON_UNESCAPED_UNICODE);
    exit;
}

$text = isset($body['text']) ? trim((string) $body['text']) : '';
if ($text === '') {
    fail(400, 'Empty text');
}
if (mb_strlen($text) > 4500) {
    fail(413, 'Text too long for one request');
}

$gender = (($body['gender'] ?? 'female') === 'male') ? 'male' : 'female';
$voice = $gender === 'male' ? 'filipp' : 'alena';

// Множитель темпа. 0.72 ≈ 85 слов/мин для alena/filipp.
$speed = isset($body['speed']) ? (float) $body['speed'] : 0.72;
$speed = max(0.1, min(3.0, $speed));

$payload = json_encode([
    'text' => $text,
    'outputAudioSpec' => ['containerAudio' => ['containerAudioType' => 'MP3']],
    'hints' => [
        ['voice' => $voice],
        ['speed' => $speed],
    ],
    'loudnessNormalizationType' => 'LUFS',
], JSON_UNESCAPED_UNICODE);

$ch = curl_init('https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Api-Key ' . $apiKey,
        'Content-Type: application/json',
        'x-folder-id: ' . $folderId,
    ],
    CURLOPT_TIMEOUT => 45,
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
    fail($status ?: 502, 'SpeechKit error', $response);
}

// v3 отдаёт поток JSON-объектов: {"result":{"audioChunk":{"data":"<base64 mp3>"}}}
// Склеиваем base64-куски из audioChunk.data в один mp3.
if (!preg_match_all('/"audioChunk"\s*:\s*\{\s*"data"\s*:\s*"([^"]*)"/', $response, $m)) {
    fail(502, 'Empty audio', substr($response, 0, 300));
}
$audio = '';
foreach ($m[1] as $b64) {
    $audio .= base64_decode($b64);
}
if ($audio === '') {
    fail(502, 'Empty audio');
}

header('Content-Type: audio/mpeg');
header('Content-Length: ' . strlen($audio));
header('Cache-Control: no-store');
echo $audio;
