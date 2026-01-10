<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
try {
    if ($userId) {
        $stmt = $pdo->prepare('SELECT p.*, u.name as author_name FROM posts p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? ORDER BY p.created_at DESC');
        $stmt->execute([$userId]);
    } else {
        $stmt = $pdo->query('SELECT p.*, u.name as author_name FROM posts p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC');
    }
    $posts = $stmt->fetchAll();

    // Fetch likes counts and whether current user liked each post
    $postIds = array_column($posts, 'id');
    $likes = [];
    if (!empty($postIds)) {
        $in = implode(',', array_map('intval', $postIds));
        $counts = $pdo->query("SELECT post_id, COUNT(*) as cnt FROM post_likes WHERE post_id IN ($in) GROUP BY post_id")->fetchAll();
        foreach ($counts as $c) $likes[$c['post_id']] = (int)$c['cnt'];
    }

    $userLiked = [];
    if (isset($_SESSION['user'])) {
        $me = (int)$_SESSION['user']['id'];
        if (!empty($postIds)) {
            $in = implode(',', array_map('intval', $postIds));
            $rows = $pdo->query("SELECT post_id FROM post_likes WHERE post_id IN ($in) AND user_id = $me")->fetchAll();
            foreach ($rows as $r) $userLiked[$r['post_id']] = true;
        }
    }

    // Attach likes info
    foreach ($posts as &$p) {
        $p['likes_count'] = isset($likes[$p['id']]) ? $likes[$p['id']] : 0;
        $p['liked_by_me'] = isset($userLiked[$p['id']]);
    }

    echo json_encode(['success' => true, 'data' => $posts]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
