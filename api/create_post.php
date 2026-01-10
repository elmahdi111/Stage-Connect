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
$content = isset($_POST['content']) ? trim($_POST['content']) : '';
$imagePath = null;

try {
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../uploads/posts/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('post_') . '.' . preg_replace('/[^a-zA-Z0-9]/', '', $ext);
        $target = $uploadDir . $filename;
        if (!move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
            throw new Exception('Could not move uploaded file');
        }
        $imagePath = 'uploads/posts/' . $filename;
    }

    $ins = $pdo->prepare('INSERT INTO posts (user_id, content, image_path) VALUES (?, ?, ?)');
    $ins->execute([$userId, $content, $imagePath]);
    $id = $pdo->lastInsertId();
    echo json_encode(['success' => true, 'id' => (int)$id, 'image_path' => $imagePath]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
