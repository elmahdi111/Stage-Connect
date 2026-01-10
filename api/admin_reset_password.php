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
$newPassword = isset($input['password']) && $input['password'] !== '' ? $input['password'] : null;

try {
    if (!$newPassword) {
        // generate a random temporary password
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $tmp = '';
        for ($i = 0; $i < 10; $i++) $tmp .= $chars[random_int(0, strlen($chars)-1)];
        $newPassword = $tmp;
    }

    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$hash, $id]);

    // Return the temporary password so admin can communicate it to the user
    echo json_encode(['success' => true, 'temporary_password' => $newPassword]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

?>
