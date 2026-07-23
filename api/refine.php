<?php
/**
 * YandexGPT proxy для кнопки «Поправь текст».
 *
 * Принимает POST JSON { text } и возвращает { text: <отредактированный> }.
 * Ключ читается из config/secrets.php: сначала `gpt_api_key`, если его нет —
 * `speechkit_api_key` (на случай единого ключа со scope foundationModels).
 * При любой ошибке отвечает JSON-ошибкой — фронтенд тогда откатывается на
 * локальную нормализацию текста.
 *
 * Требования в Yandex Cloud:
 *  - у сервисного аккаунта роль `ai.languageModels.user`;
 *  - API-ключ со scope `yc.ai.foundationModels.execute` (покрывает и SpeechKit,
 *    и YandexGPT) либо `yc.ai.languageModels.execute`.
 */

header('X-Content-Type-Options: nosniff');

function rfail(int $code, string $message, $detail = null): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message, 'detail' => $detail], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    rfail(405, 'Method not allowed');
}

$configFile = __DIR__ . '/config/secrets.php';
if (!is_file($configFile)) {
    rfail(503, 'GPT not configured');
}
$config = require $configFile;
$trimChars = " \t\n\r\0\x0B\"'";
// Берём gpt_api_key, а если он пуст (пустая строка, не только null) — speechkit_api_key.
$gptKey = trim((string) ($config['gpt_api_key'] ?? ''), $trimChars);
$ttsKey = trim((string) ($config['speechkit_api_key'] ?? ''), $trimChars);
$apiKey = $gptKey !== '' ? $gptKey : $ttsKey;
$folderId = trim((string) ($config['folder_id'] ?? ''), $trimChars);
if ($apiKey === '' || $folderId === '' || strpos($apiKey, 'ВАШ') === 0) {
    rfail(503, 'GPT not configured');
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    rfail(400, 'Invalid JSON body');
}
$text = isset($body['text']) ? trim((string) $body['text']) : '';
if ($text === '') {
    rfail(400, 'Empty text');
}
if (mb_strlen($text) > 8000) {
    rfail(413, 'Text too long');
}

$systemPrompt = <<<'PROMPT'
Ты — редактор, специализирующийся на трансформации текстов в позитивные аффирмации от первого лица. Твоя задача — отредактировать предоставленный текст так, чтобы он соответствовал следующим правилам:

1. Все предложения должны быть от первого лица единственного числа (я, мне, мой, моя и т.п.). Рассказчик описывает события, участником или свидетелем которых он является лично.

2. Время — только настоящее (настоящее длительное или простое), все утверждения позитивные и описывают идеальную жизнь автора.

3. В тексте должны быть задействованы все три системы восприятия:
   - Визуальная (зрительные образы, цвета, формы, свет, движения).
   - Аудиальная (звуки, голоса, интонации, ритмы, музыка).
   - Кинестетическая (телесные ощущения, прикосновения, эмоции, внутреннее чувство, температура, тяжесть/легкость).

4. Если какая-либо из систем отсутствует или упомянута недостаточно, добавь 1–2 коротких предложения, которые органично впишутся в смысл текста и восполнят этот пробел. Не изменяй общий смысл и не придумывай лишнего.

5. Если исходный текст уже соответствует всем условиям, оставь его без изменений (кроме возможного усиления недостающих ощущений). В итоге выдай только исправленный текст, без комментариев, объяснений или вступительных фраз.
PROMPT;

$payload = json_encode([
    'modelUri' => "gpt://{$folderId}/yandexgpt/latest",
    'completionOptions' => [
        'stream' => false,
        'temperature' => 0.3,
        'maxTokens' => '2000',
    ],
    'messages' => [
        ['role' => 'system', 'text' => $systemPrompt],
        ['role' => 'user', 'text' => $text],
    ],
], JSON_UNESCAPED_UNICODE);

$ch = curl_init('https://llm.api.cloud.yandex.net/foundationModels/v1/completion');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Api-Key ' . $apiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT => 45,
    CURLOPT_CONNECTTIMEOUT => 10,
]);
$response = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
    rfail(502, 'YandexGPT unreachable', $curlErr);
}
if ($status !== 200) {
    rfail($status ?: 502, 'YandexGPT error', $response);
}

$data = json_decode($response, true);
$refined = $data['result']['alternatives'][0]['message']['text'] ?? null;
if (!is_string($refined) || $refined === '') {
    rfail(502, 'Empty completion', $response);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['text' => trim($refined)], JSON_UNESCAPED_UNICODE);
