<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

$target = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
if (!$target) { echo json_encode(['success'=>false,'error'=>'Missing user_id']); exit; }

try {
    // total followers
    $stmt = $pdo->prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?');
    $stmt->execute([$target]);
    $followers = (int)$stmt->fetchColumn();

    // total following
    $stmt = $pdo->prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?');
    $stmt->execute([$target]);
    $following = (int)$stmt->fetchColumn();

    $iFollow = false;
    if (isset($_SESSION['user'])) {
        $me = (int)$_SESSION['user']['id'];
        $stmt = $pdo->prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1');
        $stmt->execute([$me, $target]);
        $iFollow = (bool)$stmt->fetchColumn();
    }

    echo json_encode(['success'=>true,'followers'=>$followers,'following'=>$following,'i_follow'=>$iFollow]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
?>