-- Схема БД сервиса «Медитация мечты».
-- Выполнить один раз в phpMyAdmin (панель Beget → Базы данных → phpMyAdmin),
-- вкладка SQL. Подробная инструкция: docs/beget-setup.md
--
-- Кодировка utf8mb4 обязательна: тексты пользователей на русском, возможны эмодзи.

-- Заказы. Файл MP3 НЕ хранится: в params_json лежат параметры генерации,
-- по которым браузер собирает запись заново.
CREATE TABLE IF NOT EXISTS orders (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Публичный неугадываемый идентификатор: bin2hex(random_bytes(32))
  token            CHAR(64)        NOT NULL,
  -- id платежа в ЮKassa. Пока оплата не подключена — NULL.
  payment_id       VARCHAR(64)     DEFAULT NULL,
  status           ENUM('pending','paid','canceled','refunded') NOT NULL DEFAULT 'pending',
  amount           DECIMAL(10,2)   NOT NULL,
  currency         CHAR(3)         NOT NULL DEFAULT 'RUB',
  email            VARCHAR(255)    NOT NULL,
  -- JSON { finalText, voice, speed }. СОДЕРЖИТ ПДн — обнуляется по истечении срока.
  params_json      MEDIUMTEXT      DEFAULT NULL,
  params_purged_at DATETIME        DEFAULT NULL,
  created_at       DATETIME        NOT NULL,
  paid_at          DATETIME        DEFAULT NULL,
  delivered_at     DATETIME        DEFAULT NULL,
  expires_at       DATETIME        NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_token (token),
  UNIQUE KEY uniq_payment (payment_id),
  KEY idx_expires (expires_at),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Журнал согласий. Закрывает бремя доказывания по ч. 3 ст. 9 152-ФЗ:
-- фиксирует, КТО и КОГДА согласился и с КАКОЙ редакцией документов.
CREATE TABLE IF NOT EXISTS consents (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id     BIGINT UNSIGNED NOT NULL,
  email        VARCHAR(255)    NOT NULL,
  -- Редакции документов на момент согласия, например:
  -- {"privacy":"2026-08-03","terms":"2026-08-03","consent":"2026-08-03"}
  doc_versions VARCHAR(255)    NOT NULL,
  accepted_at  DATETIME        NOT NULL,
  ip           VARCHAR(45)     DEFAULT NULL,
  user_agent   VARCHAR(500)    DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Журнал писем: антиабьюз переотправок и разбор жалоб «письмо не пришло».
CREATE TABLE IF NOT EXISTS email_log (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  email    VARCHAR(255)    NOT NULL,
  type     VARCHAR(20)     NOT NULL,  -- delivery | resend
  status   VARCHAR(20)     NOT NULL,  -- sent | failed
  sent_at  DATETIME        NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_time (order_id, sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
