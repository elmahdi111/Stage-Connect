-- Add user_id column to applications so trainee submissions can be associated with accounts
ALTER TABLE `applications` 
  ADD COLUMN `user_id` INT NULL AFTER `id`;

CREATE INDEX `idx_app_user` ON `applications` (`user_id`);

-- Optional FK (uncomment if your `users` table uses InnoDB and you want enforced constraint)
-- ALTER TABLE `applications` ADD CONSTRAINT `fk_app_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;