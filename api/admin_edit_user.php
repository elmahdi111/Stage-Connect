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
$fields = [];
$params = [];

if (isset($input['name'])) { $fields[] = 'name = ?'; $params[] = $input['name']; }
if (isset($input['email'])) { $fields[] = 'email = ?'; $params[] = $input['email']; }
if (isset($input['type'])) { $fields[] = 'type = ?'; $params[] = $input['type']; }
if (isset($input['is_admin'])) { $fields[] = 'is_admin = ?'; $params[] = ($input['is_admin'] ? 1 : 0); }
if (isset($input['password']) && $input['password'] !== '') {
    $hash = password_hash($input['password'], PASSWORD_DEFAULT);
    $fields[] = 'password_hash = ?'; $params[] = $hash;
}

if (empty($fields)) {
    echo json_encode(['success' => false, 'error' => 'No fields to update']);
    exit;
}

try {
    // Check email uniqueness if email is changing
    if (isset($input['email'])) {
        $check = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $check->execute([$input['email'], $id]);
        if ($check->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Email already in use']);
            exit;
        }
    }

    $fields[] = 'updated_at = NOW()';
    $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
    $params[] = $id;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Return updated user
    $stmt2 = $pdo->prepare('SELECT id, name, email, type, is_admin, created_at, updated_at, profile_pic, bio FROM users WHERE id = ?');
    $stmt2->execute([$id]);
    $user = $stmt2->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'user' => $user]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

?>
