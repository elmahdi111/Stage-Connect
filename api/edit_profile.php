<?php
require_once __DIR__ . '/config.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success'=>false,'error'=>'Not authenticated']);
    exit;
}

$userId = (int)$_SESSION['user']['id'];

// Handle multipart/form-data (for image) or JSON
$contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
$name = null; $email = null; $bio = null; $imagePath = null;

if (strpos($contentType, 'multipart/form-data') !== false) {
    $name = isset($_POST['name']) ? trim($_POST['name']) : null;
    $email = isset($_POST['email']) ? trim($_POST['email']) : null;
    $bio = isset($_POST['bio']) ? trim($_POST['bio']) : null;
    if (isset($_FILES['profile_pic']) && $_FILES['profile_pic']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../uploads/users/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $ext = pathinfo($_FILES['profile_pic']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('user_') . '.' . preg_replace('/[^a-zA-Z0-9]/', '', $ext);
        $target = $uploadDir . $filename;
        if (!move_uploaded_file($_FILES['profile_pic']['tmp_name'], $target)) {
            http_response_code(500);
            echo json_encode(['success'=>false,'error'=>'Could not save uploaded file']);
            exit;
        }
        $imagePath = 'uploads/users/' . $filename;
    }
} else {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!$data) $data = $_POST;
    $name = isset($data['name']) ? trim($data['name']) : null;
    $email = isset($data['email']) ? trim($data['email']) : null;
    $bio = isset($data['bio']) ? trim($data['bio']) : null;
}

try {
    // Fetch current user data
    $stmt = $pdo->prepare('SELECT name, email, profile_pic FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) { http_response_code(404); echo json_encode(['success'=>false,'error'=>'User not found']); exit; }

    // Name change: enforce limit (max 2 changes in last 30 days)
    if ($name !== null && $name !== $user['name']) {
        $cntStmt = $pdo->prepare('SELECT COUNT(*) FROM user_name_changes WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
        $cntStmt->execute([$userId]);
        $count = (int)$cntStmt->fetchColumn();
        if ($count >= 2) {
            http_response_code(403);
            echo json_encode(['success'=>false,'error'=>'Name change limit reached (2 changes per 30 days)']);
            exit;
        }
        // record change
        $ins = $pdo->prepare('INSERT INTO user_name_changes (user_id, old_name, new_name) VALUES (?, ?, ?)');
        $ins->execute([$userId, $user['name'], $name]);
        // update user's name
        $pdo->prepare('UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?')->execute([$name, $userId]);
        $_SESSION['user']['name'] = $name;
    }

    // Email change: ensure unique
    if ($email !== null && $email !== $user['email']) {
        $eStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
        $eStmt->execute([$email, $userId]);
        if ($eStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['success'=>false,'error'=>'Email already in use']);
            exit;
        }
        $pdo->prepare('UPDATE users SET email = ? WHERE id = ?')->execute([$email, $userId]);
        $_SESSION['user']['email'] = $email;
    }

    // Bio update
    if ($bio !== null) {
        $pdo->prepare('UPDATE users SET bio = ? WHERE id = ?')->execute([$bio, $userId]);
    }

    // Profile pic
    if ($imagePath !== null) {
        // delete old if exists
        if (!empty($user['profile_pic'])) {
            $old = __DIR__ . '/../' . $user['profile_pic'];
            if (file_exists($old)) @unlink($old);
        }
        $pdo->prepare('UPDATE users SET profile_pic = ? WHERE id = ?')->execute([$imagePath, $userId]);
        $_SESSION['user']['profile_pic'] = $imagePath;
    }

    echo json_encode(['success'=>true, 'user' => $_SESSION['user']]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
