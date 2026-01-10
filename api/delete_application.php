<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

// Accept JSON body or form POST
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

if (!$input || !isset($input['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing id']);
    exit;
}

$appId = (int)$input['id'];

try {
    $stmt = $pdo->prepare('SELECT * FROM applications WHERE id = ? LIMIT 1');
    $stmt->execute([$appId]);
    $app = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$app) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Application not found']);
        exit;
    }

    if (!isset($_SESSION['user'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }

    $me = $_SESSION['user'];
    $isAdmin = !empty($me['is_admin']);
    $allowed = false;

    if ($isAdmin) $allowed = true;

    // Trainee can delete their own application if user_id present
    if (!$allowed && isset($app['user_id']) && $app['user_id'] == $me['id']) {
        $allowed = true;
    }

    // Employer can delete applications for their internships
    if (!$allowed && isset($me['type']) && $me['type'] === 'employer') {
        $iid = isset($app['internship_id']) ? (int)$app['internship_id'] : 0;
        if ($iid) {
            $hasEmployerId = false;
            try {
                $col = $pdo->query("SHOW COLUMNS FROM internships LIKE 'employer_id'")->fetch();
                if ($col) $hasEmployerId = true;
            } catch (Exception $e) { }

            if ($hasEmployerId) {
                $s = $pdo->prepare('SELECT employer_id FROM internships WHERE id = ? LIMIT 1');
                $s->execute([$iid]);
                $r = $s->fetch(PDO::FETCH_ASSOC);
                if ($r && $r['employer_id'] == $me['id']) $allowed = true;
            } else {
                $s = $pdo->prepare('SELECT hotel FROM internships WHERE id = ? LIMIT 1');
                $s->execute([$iid]);
                $r = $s->fetch(PDO::FETCH_ASSOC);
                if ($r && isset($r['hotel']) && $r['hotel'] === $me['name']) $allowed = true;
            }
        }
    }

    if (!$allowed) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        exit;
    }

    // Remove resume file if present
    if (!empty($app['resume_path'])) {
        $path = __DIR__ . '/../' . ltrim($app['resume_path'], '/\\');
        if (file_exists($path)) @unlink($path);
    }

    // Delete application
    $d = $pdo->prepare('DELETE FROM applications WHERE id = ?');
    $d->execute([$appId]);

    echo json_encode(['success' => true]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit;
}

?>