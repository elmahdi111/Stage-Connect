<?php
// api/notifications.php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Not authenticated']); exit; }
$userId = (int)$_SESSION['user']['id'];

$limit = min(100, (int)($_GET['limit'] ?? 30));
$page = max(1, (int)($_GET['page'] ?? 1));
$offset = ($page-1) * $limit;

try {
    $stmt = $pdo->prepare('SELECT id, actor_id, type, title, body, data, read_at, created_at FROM notifications WHERE recipient_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?');
    $stmt->execute([$userId, $limit, $offset]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        if (isset($r['data']) && $r['data']) $r['data'] = json_decode($r['data'], true);
        $r['id'] = (int)$r['id'];
        $r['actor_id'] = $r['actor_id'] ? (int)$r['actor_id'] : null;
    }
    $cnt = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND read_at IS NULL AND deleted_at IS NULL');
    $cnt->execute([$userId]); $unread = (int)$cnt->fetchColumn();
    echo json_encode(['success'=>true,'data'=>$rows,'unread'=>$unread]);
} catch (Exception $e) {
    http_response_code(500); echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}

