<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

$hotel = isset($_GET['hotel']) ? trim($_GET['hotel']) : '';
if ($hotel === '') {
    echo json_encode(['success' => false, 'error' => 'Missing hotel parameter']);
    exit;
}

try {
    // Ensure table exists (safe to call repeatedly)
    $pdo->exec("CREATE TABLE IF NOT EXISTS hotel_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_name VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        rating TINYINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY ux_user_hotel (hotel_name, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $stmt = $pdo->prepare('SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM hotel_ratings WHERE hotel_name = ?');
    $stmt->execute([$hotel]);
    $row = $stmt->fetch();
    $avg = $row ? (float)$row['avg_rating'] : 0.0;
    $count = $row ? (int)$row['cnt'] : 0;

    $my_rating = null;
    if (isset($_SESSION['user']) && isset($_SESSION['user']['id'])) {
        $uid = (int)$_SESSION['user']['id'];
        $s2 = $pdo->prepare('SELECT rating FROM hotel_ratings WHERE hotel_name = ? AND user_id = ? LIMIT 1');
        $s2->execute([$hotel, $uid]);
        $r2 = $s2->fetch();
        if ($r2) $my_rating = (int)$r2['rating'];
    }

    echo json_encode(['success' => true, 'avg' => $avg, 'count' => $count, 'my_rating' => $my_rating]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
