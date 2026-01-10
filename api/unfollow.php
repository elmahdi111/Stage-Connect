<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Not authenticated']); exit; }
$me = (int)$_SESSION['user']['id'];
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST;
$target = isset($data['user_id']) ? (int)$data['user_id'] : 0;
if (!$target || $target === $me) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Invalid target']); exit; }

try {
    $stmt = $pdo->prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?');
    $stmt->execute([$me, $target]);
    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
?>