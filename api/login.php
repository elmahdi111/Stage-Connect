<?php
// Login endpoint using users table + password verification
require_once __DIR__ . '/config.php';
session_start();

header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST;

$email = isset($data['email']) ? trim($data['email']) : null;
$password = isset($data['password']) ? $data['password'] : null;

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email and password required']);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT id, name, email, password_hash, type, IFNULL(is_admin,0) AS is_admin FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
        exit;
    }

    if (!password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid credentials']);
        exit;
    }

    // Authentication successful: set session (include admin flag)
    $_SESSION['user'] = [ 'id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email'], 'type' => $user['type'], 'is_admin' => (int)($user['is_admin'] ?? 0) ];

    echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
