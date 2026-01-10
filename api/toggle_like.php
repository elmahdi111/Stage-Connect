<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST;
$postId = isset($data['post_id']) ? (int)$data['post_id'] : 0;
if (!$postId) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Missing post_id']); exit; }

$userId = (int)$_SESSION['user']['id'];
try {
    // check if exists
    $stmt = $pdo->prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ? LIMIT 1');
    $stmt->execute([$postId, $userId]);
    $row = $stmt->fetch();
    if ($row) {
        // unlike
        $pdo->prepare('DELETE FROM post_likes WHERE id = ?')->execute([$row['id']]);
        $action = 'unliked';
    } else {
        $ins = $pdo->prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)');
        $ins->execute([$postId, $userId]);
        $action = 'liked';
    }
    // return new count
    $cnt = $pdo->prepare('SELECT COUNT(*) as c FROM post_likes WHERE post_id = ?');
    $cnt->execute([$postId]);
    $c = $cnt->fetchColumn();
    echo json_encode(['success'=>true, 'action'=>$action, 'count' => (int)$c]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
