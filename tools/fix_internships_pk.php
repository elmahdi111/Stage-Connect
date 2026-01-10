<?php
/**
 * Migration script to fix the internships table PRIMARY KEY to use AUTO_INCREMENT
 * Run this once: php tools/fix_internships_pk.php
 */
require_once __DIR__ . '/../api/config.php';

try {
    echo "Attempting to fix internships table PRIMARY KEY...\n";
    
    // Disable foreign key checks temporarily
    $pdo->exec("SET FOREIGN_KEY_CHECKS=0");
    echo "✓ Foreign key checks disabled.\n";
    
    // Drop and recreate the table with correct schema
    $pdo->exec("DROP TABLE IF EXISTS `internships`");
    echo "✓ Old table dropped.\n";
    
    $createTableSQL = "
        CREATE TABLE `internships` (
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
        )
    ";
    
    $pdo->exec($createTableSQL);
    echo "✓ Table schema fixed.\n";
    
    // Re-insert the seed data with proper IDs
    $insertSQL = "
        INSERT INTO `internships` (`id`,`hotel`,`location`,`title_ar`,`title_fr`,`title_en`,`type_ar`,`type_fr`,`type_en`,`duration_ar`,`duration_fr`,`duration_en`,`rating`,`image`,`description_ar`,`description_fr`,`description_en`)
        VALUES
        (1,'Royal Atlas Agadir','Zone Touristique','متدرب في قسم الاستقبال','Stagiaire Réception','Front Office Trainee','استقبال','Réception','Front Office','3 أشهر','3 Mois','3 Months',5,'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000','نبحث عن متدربين شغوفين للانضمام لفريق الاستقبال.','Nous recherchons des stagiaires passionnés.','Looking for passionate trainees.'),
        (2,'Sofitel Agadir Thalassa','Agadir Centre','مساعد شيف','Commis de Cuisine','Kitchen Assistant','طبخ','Cuisine','Cuisine','6 أشهر','6 Mois','6 Months',5,'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=1000','فرصة للتدرب في مطبخ عالمي.','Opportunité de stage dans une cuisine internationale.','Opportunity to train in a world-class kitchen.'),
        (3,'Hyatt Regency Taghazout','Taghazout Bay','خدمة الغرف','Femme/Valet de Chambre','Housekeeping','تدبير فندقي','Housekeeping','Housekeeping','4 أشهر','4 Mois','4 Months',5,'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000','تعلم أصول التدبير الفندقي.','Apprenez les standards du housekeeping.','Learn housekeeping standards.'),
        (4,'Robinson Club','Zone Touristique','نادِل / نادِلة','Serveur / Serveuse','Waiter / Waitress','مطعم','Restauration','Restaurant','3 أشهر','3 Mois','3 Months',4,'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000','مطلوب متدربين لخدمة المطعم.','Stagiaires recherchés pour le service.','Trainees needed for restaurant service.'),
        (5,'Fairmont Taghazout Bay','Taghazout Bay','متدربة في السبا','Stagiaire Spa','Spa Therapist Trainee','صحة ورفاهية','Bien-être','SPA & Wellness','6 أشهر','6 Mois','6 Months',5,'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=1000','انضم لفريق المركز الصحي الفاخر.','Rejoignez notre équipe bien-être.','Join our luxury wellness center team.'),
        (8,'Hilton Taghazout Bay','Taghazout Bay','مساعد ساقي','Assistant Barman','Barman Assistant','مطعم','Restauration','Restaurant','3 أشهر','3 Mois','3 Months',5,'https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&q=80&w=1000','المساعدة في عمليات البار.','Assister aux opérations du bar.','Assist in bar operations.')
    ";
    
    $pdo->exec($insertSQL);
    echo "✓ Seed data re-inserted.\n";
    
    // Re-enable foreign key checks
    $pdo->exec("SET FOREIGN_KEY_CHECKS=1");
    echo "✓ Foreign key checks re-enabled.\n";
    echo "\nSuccess! The internships table is now fixed and ready for AUTO_INCREMENT inserts.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
