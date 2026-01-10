<?php
require_once __DIR__ . '/config.php';
session_start();

header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST;

$id = isset($data['id']) ? (int)$data['id'] : 0;
if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing internship id']);
    exit;
}

try {
    $stmt = $pdo->prepare('SELECT * FROM internships WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Not found']);
        exit;
    }

    $user = isset($_SESSION['user']) ? $_SESSION['user'] : null;
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }

    $isOwner = false;
    if (isset($row['employer_id']) && $row['employer_id']) {
        if ((int)$row['employer_id'] === (int)$user['id'] || ($user['is_admin'] ?? 0)) $isOwner = true;
    } else {
        if ($user['type'] === 'employer' && $user['name'] === $row['hotel']) $isOwner = true;
        if ($user['is_admin'] ?? 0) $isOwner = true;
    }

    if (!$isOwner) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not allowed']);
        exit;
    }

    // Delete internship; applications have FK ON DELETE SET NULL so they remain safe
    $d = $pdo->prepare('DELETE FROM internships WHERE id = ?');
    $d->execute([$id]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
