<?php
require 'api/config.php';
$r = $pdo->query('SELECT id, hotel, location, title_ar, title_fr, title_en, type_ar, type_fr, type_en, duration_ar, duration_fr, duration_en, start_date FROM internships WHERE id = 11')->fetch();
echo json_encode($r, JSON_PRETTY_PRINT);
?>
