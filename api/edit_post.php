<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$userId = (int)$_SESSION['user']['id'];
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST;

$postId = isset($data['id']) ? (int)$data['id'] : 0;
$content = isset($data['content']) ? $data['content'] : null;

if (!$postId) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Missing id']); exit; }

try {
    // Check ownership
    $stmt = $pdo->prepare('SELECT user_id FROM posts WHERE id = ? LIMIT 1');
    $stmt->execute([$postId]);
    $row = $stmt->fetch();
    if (!$row || (int)$row['user_id'] !== $userId) {
        http_response_code(403);
        echo json_encode(['success'=>false,'error'=>'Not allowed']);
        exit;
    }

    if ($content !== null) {
        $upd = $pdo->prepare('UPDATE posts SET content = ?, updated_at = NOW() WHERE id = ?');
        $upd->execute([$content, $postId]);
    }

    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
