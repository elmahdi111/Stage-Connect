<?php
require 'api/config.php';

// Fix record 11 with proper multilingual values
$stmt = $pdo->prepare('UPDATE internships SET title_ar = ?, title_fr = ?, type_ar = ?, type_fr = ?, duration_ar = ?, duration_fr = ? WHERE id = 11');
$stmt->execute(['www', 'www', 'Serveur/Serveuse', 'Serveur/Serveuse', '3', '3']);

echo "Fixed record 11\n";

// Also fix any other records with NULL type_ar/type_fr/duration_ar/duration_fr
$stmt2 = $pdo->prepare('UPDATE internships SET 
    type_ar = COALESCE(type_ar, type_en),
    type_fr = COALESCE(type_fr, type_en),
    duration_ar = COALESCE(duration_ar, duration_en),
    duration_fr = COALESCE(duration_fr, duration_en),
    title_ar = COALESCE(title_ar, title_en),
    title_fr = COALESCE(title_fr, title_en)
WHERE type_ar IS NULL OR type_fr IS NULL OR duration_ar IS NULL OR duration_fr IS NULL');
$stmt2->execute();

echo "Fixed all records with NULL multilingual fields\n";
?>
