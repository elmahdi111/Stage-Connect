-- Create database and tables for StageConnect
-- Run this in MySQL (e.g., via phpMyAdmin or mysql CLI)

CREATE DATABASE IF NOT EXISTS `stageconnect` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `stageconnect`;

-- internships table
CREATE TABLE IF NOT EXISTS `internships` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `hotel` VARCHAR(255) NOT NULL,
  `location` VARCHAR(100) NOT NULL,
  `title_ar` TEXT,
  `title_fr` TEXT,
  `title_en` TEXT,
  `type_ar` VARCHAR(100),
  `type_fr` VARCHAR(100),
  `type_en` VARCHAR(100),
  `duration_ar` VARCHAR(50),
  `duration_fr` VARCHAR(50),
  `duration_en` VARCHAR(50),
  `start_date` DATE DEFAULT NULL,
  `rating` TINYINT DEFAULT 5,
  `image` TEXT,
  `description_ar` TEXT,
  `description_fr` TEXT,
  `description_en` TEXT
);

-- applications table
CREATE TABLE IF NOT EXISTS `applications` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `internship_id` INT NULL,
  `applicant_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50),
  `school` VARCHAR(255),
  `date_applied` DATE NOT NULL,
  `status` ENUM('pending','approved','rejected') DEFAULT 'pending',
  `resume_path` VARCHAR(1024) DEFAULT NULL,
  `extra` JSON DEFAULT NULL,
  FOREIGN KEY (`internship_id`) REFERENCES `internships`(`id`) ON DELETE SET NULL
);

-- Posts table for user-generated content
CREATE TABLE IF NOT EXISTS `posts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `content` TEXT,
  `image_path` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Likes for posts
CREATE TABLE IF NOT EXISTS `post_likes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `post_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `post_user_unique` (`post_id`,`user_id`),
  KEY `post_idx` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add profile fields to users if missing
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `profile_pic` VARCHAR(1024) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `bio` TEXT DEFAULT NULL;

-- Track user name changes to enforce limits (e.g., max 2 changes per 30 days)
CREATE TABLE IF NOT EXISTS `user_name_changes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `old_name` VARCHAR(255) DEFAULT NULL,
  `new_name` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `internships` (`id`,`hotel`,`location`,`title_ar`,`title_fr`,`title_en`,`type_ar`,`type_fr`,`type_en`,`duration_ar`,`duration_fr`,`duration_en`,`rating`,`image`,`description_ar`,`description_fr`,`description_en`)
VALUES
(1,'Royal Atlas Agadir','Zone Touristique','متدرب في قسم الاستقبال','Stagiaire Réception','Front Office Trainee','استقبال','Réception','Front Office','3 أشهر','3 Mois','3 Months',5,'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000','نبحث عن متدربين شغوفين للانضمام لفريق الاستقبال.','Nous recherchons des stagiaires passionnés.','Looking for passionate trainees.'),
(2,'Sofitel Agadir Thalassa','Agadir Centre','مساعد شيف','Commis de Cuisine','Kitchen Assistant','طبخ','Cuisine','Cuisine','6 أشهر','6 Mois','6 Months',5,'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=1000','فرصة للتدرب في مطبخ عالمي.','Opportunité de stage dans une cuisine internationale.','Opportunity to train in a world-class kitchen.'),
(3,'Hyatt Regency Taghazout','Taghazout Bay','خدمة الغرف','Femme/Valet de Chambre','Housekeeping','تدبير فندقي','Housekeeping','Housekeeping','4 أشهر','4 Mois','4 Months',5,'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000','تعلم أصول التدبير الفندقي.','Apprenez les standards du housekeeping.','Learn housekeeping standards.'),
(4,'Robinson Club','Zone Touristique','نادِل / نادِلة','Serveur / Serveuse','Waiter / Waitress','مطعم','Restauration','Restaurant','3 أشهر','3 Mois','3 Months',4,'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000','مطلوب متدربين لخدمة المطعم.','Stagiaires recherchés pour le service.','Trainees needed for restaurant service.'),
(5,'Fairmont Taghazout Bay','Taghazout Bay','متدربة في السبا','Stagiaire Spa','Spa Therapist Trainee','صحة ورفاهية','Bien-être','SPA & Wellness','6 أشهر','6 Mois','6 Months',5,'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=1000','انضم لفريق المركز الصحي الفاخر.','Rejoignez notre équipe bien-être.','Join our luxury wellness center team.'),
(8,'Hilton Taghazout Bay','Taghazout Bay','مساعد ساقي','Assistant Barman','Barman Assistant','مطعم','Restauration','Restaurant','3 أشهر','3 Mois','3 Months',5,'https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&q=80&w=1000','المساعدة في عمليات البار.','Assister aux opérations du bar.','Assist in bar operations.');

-- users table for login/signup
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `type` ENUM('trainee','employer') NOT NULL DEFAULT 'trainee',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  `is_admin` TINYINT(1) DEFAULT 0
);

-- You can create an initial admin user here by inserting a row into `users`.
-- We store password hashes generated by PHP's password_hash().
-- Instead of embedding a precomputed hash here (which requires computing it with PHP),
-- you can run the helper script `tools/create_admin.php` included in this project.

-- Example (COMMENTED OUT): Replace <PASSWORD_HASH> with a PHP-generated hash
-- INSERT INTO users (name,email,password_hash,type,is_admin,created_at) VALUES ('admin','nourddin@admin.com','<PASSWORD_HASH>','employer',1,NOW());

-- To generate and insert the admin using PHP, run from the project root:
-- php tools/create_admin.php

