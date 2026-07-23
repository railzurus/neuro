<?php
/**
 * ШАБЛОН секретов. Скопируйте этот файл рядом под именем `secrets.php`
 * и подставьте ваши ключи.
 *
 * ВАЖНО: `secrets.php` не коммитится в git (см. .gitignore) и загружается
 * на сервер Beget ВРУЧНУЮ через файловый менеджер / FTP — один раз.
 * Деплой его не перезапишет и не удалит.
 *
 * Где взять ключ: console.yandex.cloud → сервисный аккаунт → «Создать API-ключ».
 */

return [
    // Ключ для SpeechKit (синтез речи).
    // Роль: ai.speechkit-tts.user, scope: yc.ai.speechkitTts.execute
    // (или широкий yc.ai.foundationModels.execute — тогда этого ключа хватит и на GPT).
    'speechkit_api_key' => 'ВАШ_API_КЛЮЧ_SPEECHKIT',

    // (Необязательно) Отдельный ключ для YandexGPT (кнопка «Поправь текст»).
    // Роль: ai.languageModels.user, scope: yc.ai.foundationModels.execute
    // (или yc.ai.languageModels.execute).
    // Если оставить пустым — refine.php использует speechkit_api_key выше.
    'gpt_api_key' => '',

    // ID каталога (folder) в Yandex Cloud:
    'folder_id' => 'b1gqup3e0rqpm27e4vc4',
];
