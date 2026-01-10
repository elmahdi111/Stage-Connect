<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

// Only admins allowed
if (!isset($_SESSION['user']) || empty($_SESSION['user']['is_admin'])) {
    // If debug flag is provided, return session and headers to help debugging login/session issues.
    if (isset($_GET['debug']) && $_GET['debug'] == '1') {
        http_response_code(403);
        $info = [
            'success' => false,
            'error' => 'Forbidden',
            'session' => isset($_SESSION) ? $_SESSION : null,
            'cookies' => isset($_COOKIE) ? $_COOKIE : null,
            'headers' => function_exists('getallheaders') ? getallheaders() : null,
        ];
        echo json_encode($info);
        exit;
    }

    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

try {
    // Exclude the currently logged-in admin from the returned list to prevent self-edit/delete
    $currentId = isset($_SESSION['user']['id']) ? (int)$_SESSION['user']['id'] : 0;
    $stmt = $pdo->prepare('SELECT id, name, email, type, is_admin, created_at, updated_at, profile_pic, bio FROM users WHERE id != ? ORDER BY id DESC');
    $stmt->execute([$currentId]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'data' => $users]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

?>
