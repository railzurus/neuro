<?php
/**
 * Единый предел на длину истории.
 *
 * Держим его в одном месте, потому что проверять приходится в трёх точках:
 * создание заказа, YandexGPT и SpeechKit. Фронтенд знает те же числа
 * (src/data/roles.ts), но полагаться на него нельзя — эндпоинты открыты,
 * и вызвать их можно в обход интерфейса.
 */

/** Слов во всей истории: девять ролей по 120. */
const TEXT_WORD_LIMIT = 1200;

/**
 * Символьный потолок. Считать слова у мегабайтной строки уже дорого, поэтому
 * сначала отсекаем по длине: 1200 слов русского текста — это примерно 9000
 * символов, берём запас на длинные слова и знаки.
 */
const TEXT_MAX_CHARS = 14000;

/** Слова так же, как их считает фронтенд (wordCount в src/lib/refine.ts). */
function text_word_count(string $text): int
{
    $words = preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY);
    return is_array($words) ? count($words) : 0;
}

/** Укладывается ли текст в общий предел. */
function text_within_limit(string $text): bool
{
    return mb_strlen($text) <= TEXT_MAX_CHARS && text_word_count($text) <= TEXT_WORD_LIMIT;
}
