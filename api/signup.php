<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST;

$name = isset($data['name']) ? trim($data['name']) : null;
$email = isset($data['email']) ? trim($data['email']) : null;
$password = isset($data['password']) ? $data['password'] : null;
$type = isset($data['type']) && in_array($data['type'], ['trainee','employer']) ? $data['type'] : 'trainee';

if (!$name || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

try {
    // Check duplicate email
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Email already in use']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $ins = $pdo->prepare('INSERT INTO users (name, email, password_hash, type) VALUES (?, ?, ?, ?)');
    $ins->execute([$name, $email, $hash, $type]);
    $id = $pdo->lastInsertId();

    // Return created user (without password)
    echo json_encode(['success' => true, 'user' => ['id' => (int)$id, 'name' => $name, 'email' => $email, 'type' => $type]]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
