<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Not authenticated']); exit; }
$userId = (int)$_SESSION['user']['id'];
$postId = isset($_POST['post_id']) ? (int)$_POST['post_id'] : 0;
$content = isset($_POST['content']) ? trim($_POST['content']) : '';
if (!$postId || $content === '') { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Invalid parameters']); exit; }
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

    $ins = $pdo->prepare('INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)');
    $ins->execute([$postId, $userId, $content]);
    $id = $pdo->lastInsertId();
    // return the created comment id and created_at
    $sel = $pdo->prepare('SELECT c.*, u.name as author_name FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ? LIMIT 1');
    $sel->execute([$id]);
    $row = $sel->fetch();
    if ($row) {
        $row['created_at'] = date(DATE_ATOM, strtotime($row['created_at']));
    }
    echo json_encode(['success'=>true,'id'=> (int)$id, 'comment' => $row]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
