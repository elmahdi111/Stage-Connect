<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Not authenticated']); exit; }
$userId = (int)$_SESSION['user']['id'];
$isAdmin = !empty($_SESSION['user']['is_admin']);

$commentId = isset($_POST['comment_id']) ? (int)$_POST['comment_id'] : 0;
if (!$commentId) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Invalid parameters']); exit; }

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS post_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    // ensure updated_at exists
    $col = $pdo->query("SHOW COLUMNS FROM post_comments LIKE 'updated_at'")->fetch();
    if (!$col) {
        try { $pdo->exec("ALTER TABLE post_comments ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL AFTER created_at"); } catch (Exception $e) { /* ignore */ }
    }

    $stmt = $pdo->prepare('SELECT * FROM post_comments WHERE id = ? LIMIT 1');
    $stmt->execute([$commentId]);
    $row = $stmt->fetch();
    if (!$row) { http_response_code(404); echo json_encode(['success'=>false,'error'=>'Comment not found']); exit; }
    if ($row['user_id'] != $userId && !$isAdmin) { http_response_code(403); echo json_encode(['success'=>false,'error'=>'Not allowed']); exit; }

    $del = $pdo->prepare('DELETE FROM post_comments WHERE id = ?');
    $del->execute([$commentId]);
    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
