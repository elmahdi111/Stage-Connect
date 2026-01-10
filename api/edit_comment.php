<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Not authenticated']); exit; }
$userId = (int)$_SESSION['user']['id'];
$isAdmin = !empty($_SESSION['user']['is_admin']);

$commentId = isset($_POST['comment_id']) ? (int)$_POST['comment_id'] : 0;
$content = isset($_POST['content']) ? trim($_POST['content']) : '';
if (!$commentId || $content === '') { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Invalid parameters']); exit; }

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

    // check ownership
    $stmt = $pdo->prepare('SELECT * FROM post_comments WHERE id = ? LIMIT 1');
    $stmt->execute([$commentId]);
    $row = $stmt->fetch();
    if (!$row) { http_response_code(404); echo json_encode(['success'=>false,'error'=>'Comment not found']); exit; }
    if ($row['user_id'] != $userId && !$isAdmin) { http_response_code(403); echo json_encode(['success'=>false,'error'=>'Not allowed']); exit; }

    $upd = $pdo->prepare('UPDATE post_comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $upd->execute([$content, $commentId]);

    // return updated row
    $sel = $pdo->prepare('SELECT c.*, u.name as author_name FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ? LIMIT 1');
    $sel->execute([$commentId]);
    $new = $sel->fetch();
    if ($new) {
        $new['created_at'] = date(DATE_ATOM, strtotime($new['created_at']));
        if ($new['updated_at']) $new['updated_at'] = date(DATE_ATOM, strtotime($new['updated_at']));
    }
    echo json_encode(['success'=>true,'comment'=>$new]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
