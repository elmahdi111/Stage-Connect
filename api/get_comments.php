<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

$postId = isset($_GET['post_id']) ? (int)$_GET['post_id'] : 0;
if (!$postId) { echo json_encode(['success'=>false,'error'=>'Missing post_id']); exit; }
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS post_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    // ensure updated_at exists (for older DBs)
    $col = $pdo->query("SHOW COLUMNS FROM post_comments LIKE 'updated_at'")->fetch();
    if (!$col) {
        try { $pdo->exec("ALTER TABLE post_comments ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL AFTER created_at"); } catch (Exception $e) { /* ignore */ }
    }

    $stmt = $pdo->prepare('SELECT c.*, u.name as author_name FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at DESC');
    $stmt->execute([$postId]);
    $rows = $stmt->fetchAll();
    // mark which comments can be edited/deleted by current user
    $currentUserId = isset($_SESSION['user']) ? (int)$_SESSION['user']['id'] : 0;
    $isAdmin = isset($_SESSION['user']) && !empty($_SESSION['user']['is_admin']);
    foreach ($rows as &$r) {
        $r['can_edit'] = ($currentUserId && $r['user_id'] == $currentUserId) || $isAdmin;
        // normalize timestamps
        if (isset($r['created_at'])) $r['created_at'] = date(DATE_ATOM, strtotime($r['created_at']));
        if (isset($r['updated_at']) && $r['updated_at']) $r['updated_at'] = date(DATE_ATOM, strtotime($r['updated_at']));
    }
    echo json_encode(['success'=>true,'data'=>$rows]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
