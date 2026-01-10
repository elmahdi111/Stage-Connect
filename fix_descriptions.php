<?php
require 'api/config.php';

// Fix description fields for record 11
$stmt = $pdo->prepare('UPDATE internships SET description_ar = ?, description_fr = ? WHERE id = 11');
$stmt->execute(['wwwwww', 'wwwwww']);

// Also fix any other records with NULL description_ar/description_fr
$stmt2 = $pdo->prepare('UPDATE internships SET 
    description_ar = COALESCE(description_ar, description_en),
    description_fr = COALESCE(description_fr, description_en)
WHERE description_ar IS NULL OR description_fr IS NULL');
$stmt2->execute();

echo "Fixed all description fields\n";
?>
