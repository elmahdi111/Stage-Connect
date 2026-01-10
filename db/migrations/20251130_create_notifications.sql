-- Migration: Create notifications table (DB-only notification system)

CREATE TABLE IF NOT EXISTS notifications (
	id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	recipient_id BIGINT UNSIGNED NOT NULL,
	actor_id BIGINT UNSIGNED DEFAULT NULL,
	type VARCHAR(191) NOT NULL,
	title VARCHAR(191) DEFAULT NULL,
	body TEXT DEFAULT NULL,
	data JSON DEFAULT NULL,
	read_at DATETIME DEFAULT NULL,
	deleted_at DATETIME DEFAULT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	INDEX (recipient_id),
	INDEX (actor_id),
	INDEX (type),
	INDEX (created_at),
	INDEX (recipient_id, read_at)
);


