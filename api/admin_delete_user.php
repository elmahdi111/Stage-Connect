<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

if (!isset($_SESSION['user']) || empty($_SESSION['user']['is_admin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing parameters']);
    exit;
}

$id = (int)$input['id'];

try {
    // Delete user's posts and uploaded files
    $posts = $pdo->prepare('SELECT image_path FROM posts WHERE user_id = ?');
    $posts->execute([$id]);
    foreach ($posts->fetchAll(PDO::FETCH_ASSOC) as $p) {
        if (!empty($p['image_path']) && file_exists(__DIR__ . '/../' . $p['image_path'])) {
            @unlink(__DIR__ . '/../' . $p['image_path']);
        }
    }
    $pdo->prepare('DELETE FROM posts WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM post_likes WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM user_name_changes WHERE user_id = ?')->execute([$id]);

    // Remove profile pic
    $stmt = $pdo->prepare('SELECT profile_pic FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['profile_pic']) && file_exists(__DIR__ . '/../' . $row['profile_pic'])) {
        @unlink(__DIR__ . '/../' . $row['profile_pic']);
    }

    // Delete comments by user
    try { $pdo->prepare('DELETE FROM post_comments WHERE user_id = ?')->execute([$id]); } catch (Exception $e) { /* ignore */ }

    // Delete follows where user is follower or following
    try { $pdo->prepare('DELETE FROM follows WHERE follower_id = ? OR following_id = ?')->execute([$id, $id]); } catch (Exception $e) { /* ignore */ }

    // Delete notifications where user is recipient or actor
    try { $pdo->prepare('DELETE FROM notifications WHERE recipient_id = ? OR actor_id = ?')->execute([$id, $id]); } catch (Exception $e) { /* ignore */ }

    // Delete applications submitted by this user (remove resume files)
    try {
        $apps = $pdo->prepare('SELECT id, resume_path FROM applications WHERE user_id = ?');
        $apps->execute([$id]);
        foreach ($apps->fetchAll(PDO::FETCH_ASSOC) as $a) {
            if (!empty($a['resume_path']) && file_exists(__DIR__ . '/../' . $a['resume_path'])) {
                @unlink(__DIR__ . '/../' . $a['resume_path']);
            }
        }
        $pdo->prepare('DELETE FROM applications WHERE user_id = ?')->execute([$id]);
    } catch (Exception $e) { /* ignore */ }

    // If the user is an employer/hotel, delete their internships and related applications/ratings
    $u = $pdo->prepare('SELECT id, name, type FROM users WHERE id = ? LIMIT 1');
    $u->execute([$id]);
    $userRow = $u->fetch(PDO::FETCH_ASSOC);
    if ($userRow && isset($userRow['type']) && $userRow['type'] === 'employer') {
        $hotelName = $userRow['name'];
        // Find internships by employer_id if present, otherwise by hotel name
        $hasEmployerIdCol = false;
        try {
            $col = $pdo->query("SHOW COLUMNS FROM internships LIKE 'employer_id'")->fetch();
            if ($col) $hasEmployerIdCol = true;
        } catch (Exception $e) { /* ignore */ }

        if ($hasEmployerIdCol) {
            $stmt = $pdo->prepare('SELECT id FROM internships WHERE employer_id = ?');
            $stmt->execute([$id]);
        } else {
            $stmt = $pdo->prepare('SELECT id FROM internships WHERE hotel = ?');
            $stmt->execute([$hotelName]);
        }
        $internships = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($internships as $it) {
            $iid = (int)$it['id'];
            // delete applications for this internship (and remove resume files)
            try {
                $apps = $pdo->prepare('SELECT id, resume_path FROM applications WHERE internship_id = ?');
                $apps->execute([$iid]);
                foreach ($apps->fetchAll(PDO::FETCH_ASSOC) as $a) {
                    if (!empty($a['resume_path']) && file_exists(__DIR__ . '/../' . $a['resume_path'])) {
                        @unlink(__DIR__ . '/../' . $a['resume_path']);
                    }
                }
                $pdo->prepare('DELETE FROM applications WHERE internship_id = ?')->execute([$iid]);
            } catch (Exception $e) { /* ignore */ }

            // delete notifications that reference this internship in JSON data (best-effort using LIKE)
            try {
                $like = '%"internship_id":' . $iid . '%';
                $pdo->prepare('DELETE FROM notifications WHERE data LIKE ?')->execute([$like]);
            } catch (Exception $e) {
                // ignore
            }

            // finally delete the internship
            try { $pdo->prepare('DELETE FROM internships WHERE id = ?')->execute([$iid]); } catch (Exception $e) { /* ignore */ }
        }

        // delete hotel ratings for this hotel
        try { $pdo->prepare('DELETE FROM hotel_ratings WHERE hotel_name = ?')->execute([$hotelName]); } catch (Exception $e) { /* ignore */ }
    }

    // Finally delete user
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

?>
