<?php
require 'api/config.php';
$stmt = $pdo->query('SELECT * FROM internships WHERE id = 11');
$row = $stmt->fetch();

// Map it the same way the API does
$result = [
    'id' => (int)$row['id'],
    'hotel' => $row['hotel'],
    'location' => $row['location'],
    'start_date' => $row['start_date'],
    'title' => [ 'ar' => $row['title_ar'], 'fr' => $row['title_fr'], 'en' => $row['title_en'] ],
    'type' => [ 'ar' => $row['type_ar'], 'fr' => $row['type_fr'], 'en' => $row['type_en'] ],
    'duration' => [ 'ar' => $row['duration_ar'], 'fr' => $row['duration_fr'], 'en' => $row['duration_en'] ],
    'rating' => (int)$row['rating'],
    'image' => $row['image'],
    'description' => [ 'ar' => $row['description_ar'], 'fr' => $row['description_fr'], 'en' => $row['description_en'] ]
];

echo json_encode($result, JSON_PRETTY_PRINT);
?>
