-- Миграция 001: счётчик пересборок записи и таблица лимитов частоты.
--
-- Нужна, если база уже создана по прежней версии schema.sql.
-- Выполнить один раз в phpMyAdmin (вкладка SQL) для базы сайта.
-- На чистой базе ничего выполнять не нужно — всё уже есть в schema.sql.

ALTER TABLE orders
  ADD COLUMN download_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER params_purged_at;

CREATE TABLE IF NOT EXISTS rate_limit (
  id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket VARCHAR(32)     NOT NULL,
  ident  VARCHAR(64)     NOT NULL,
  hit_at DATETIME        NOT NULL,
  PRIMARY KEY (id),
  KEY idx_lookup (bucket, ident, hit_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
