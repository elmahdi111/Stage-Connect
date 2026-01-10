<?php
// api/notifications_mark_read.php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Not authenticated']); exit; }
$userId = (int)$_SESSION['user']['id'];

$input = $_POST ?: json_decode(file_get_contents('php://input'), true);
$id = isset($input['notification_id']) ? (int)$input['notification_id'] : 0;
if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'notification_id required']); exit; }

try {
    $stmt = $pdo->prepare('UPDATE notifications SET read_at = NOW() WHERE id = ? AND recipient_id = ?');
    $stmt->execute([$id, $userId]);
    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    http_response_code(500); echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
