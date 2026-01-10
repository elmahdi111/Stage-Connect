<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $stmt = $pdo->query('SELECT * FROM internships ORDER BY id ASC');
    $rows = $stmt->fetchAll();

    // Map DB columns into the structure the frontend expects
    $result = array_map(function($r) {
        return [
            'id' => (int)$r['id'],
            'hotel' => $r['hotel'],
            'location' => $r['location'],
            'start_date' => $r['start_date'],
            'title' => [ 'ar' => $r['title_ar'], 'fr' => $r['title_fr'], 'en' => $r['title_en'] ],
            'type' => [ 'ar' => $r['type_ar'], 'fr' => $r['type_fr'], 'en' => $r['type_en'] ],
            'duration' => [ 'ar' => $r['duration_ar'], 'fr' => $r['duration_fr'], 'en' => $r['duration_en'] ],
            'rating' => (int)$r['rating'],
            'image' => $r['image'],
            'description' => [ 'ar' => $r['description_ar'], 'fr' => $r['description_fr'], 'en' => $r['description_en'] ],
            // optional employer_id if the schema includes it
            'employer_id' => isset($r['employer_id']) ? (int)$r['employer_id'] : null
        ];
    }, $rows);

    echo json_encode(['success' => true, 'data' => $result]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
