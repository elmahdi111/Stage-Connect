<?php
// api/notifications_mark_all_read.php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Not authenticated']); exit; }
$userId = (int)$_SESSION['user']['id'];

try {
    $stmt = $pdo->prepare('UPDATE notifications SET read_at = NOW() WHERE recipient_id = ? AND read_at IS NULL');
    $stmt->execute([$userId]);
    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    http_response_code(500); echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
