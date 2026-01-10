<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user']) || !isset($_SESSION['user']['id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$userId = (int)$_SESSION['user']['id'];
$hotel = isset($_POST['hotel']) ? trim($_POST['hotel']) : '';
$rating = isset($_POST['rating']) ? (int)$_POST['rating'] : 0;

if ($hotel === '' || $rating < 1 || $rating > 5) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid parameters']);
    exit;
}

try {
    // Ensure table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS hotel_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hotel_name VARCHAR(255) NOT NULL,
        user_id INT NOT NULL,
        rating TINYINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY ux_user_hotel (hotel_name, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Upsert: update if exists, otherwise insert
    $sel = $pdo->prepare('SELECT id FROM hotel_ratings WHERE hotel_name = ? AND user_id = ? LIMIT 1');
    $sel->execute([$hotel, $userId]);
    $found = $sel->fetch();
    if ($found) {
        $upd = $pdo->prepare('UPDATE hotel_ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $upd->execute([$rating, $found['id']]);
    } else {
        $ins = $pdo->prepare('INSERT INTO hotel_ratings (hotel_name, user_id, rating) VALUES (?, ?, ?)');
        $ins->execute([$hotel, $userId, $rating]);
    }

    // Return refreshed stats
    $s = $pdo->prepare('SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM hotel_ratings WHERE hotel_name = ?');
    $s->execute([$hotel]);
    $r = $s->fetch();
    $avg = $r ? (float)$r['avg_rating'] : 0.0;
    $count = $r ? (int)$r['cnt'] : 0;

    echo json_encode(['success' => true, 'avg' => $avg, 'count' => $count, 'my_rating' => $rating]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
