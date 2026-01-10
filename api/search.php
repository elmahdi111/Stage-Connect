<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$type = isset($_GET['type']) ? trim($_GET['type']) : 'all';
if ($q === '') { echo json_encode(['success'=>false,'error'=>'Missing query']); exit; }

try {
    $out = ['success'=>true,'query'=>$q,'type'=>$type,'results'=>[]];
    $like = '%' . str_replace(' ', '%', $q) . '%';
    if ($type === 'all' || $type === 'posts') {
        $stmt = $pdo->prepare('SELECT p.*, u.name as author_name FROM posts p JOIN users u ON u.id = p.user_id WHERE p.content LIKE ? ORDER BY p.created_at DESC LIMIT 50');
        $stmt->execute([$like]);
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
        
        $out['results']['posts'] = $posts;
    }
    if ($type === 'all' || $type === 'offers') {
        // search internships by title, type, location or hotel name
        $stmt = $pdo->prepare('SELECT * FROM internships WHERE title_en LIKE ? OR title_fr LIKE ? OR title_ar LIKE ? OR location LIKE ? OR type_en LIKE ? OR type_fr LIKE ? OR type_ar LIKE ? OR hotel LIKE ? LIMIT 50');
        $stmt->execute([$like,$like,$like,$like,$like,$like,$like,$like]);
        $out['results']['offers'] = $stmt->fetchAll();

        // also return matching hotel names (distinct)
        $hstmt = $pdo->prepare('SELECT DISTINCT hotel FROM internships WHERE hotel LIKE ? LIMIT 50');
        $hstmt->execute([$like]);
        $hotels = array_map(function($r){ return $r['hotel']; }, $hstmt->fetchAll());
        $out['results']['hotels'] = $hotels;
    }
    if ($type === 'all' || $type === 'users') {
        $stmt = $pdo->prepare('SELECT id, name, email, bio, profile_pic FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 50');
        $stmt->execute([$like,$like]);
        $out['results']['users'] = $stmt->fetchAll();
    }
    echo json_encode($out);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
