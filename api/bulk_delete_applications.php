<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['ids']) || !is_array($input['ids'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing or invalid ids']);
    exit;
}

if (!isset($_SESSION['user'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$me = $_SESSION['user'];
$isAdmin = !empty($me['is_admin']);
$isEmployer = isset($me['type']) && $me['type'] === 'employer';

if (!$isAdmin && !$isEmployer) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Only admins and employers can bulk delete']);
    exit;
}

try {
    $deletedIds = [];
    $failedIds = [];

    foreach ($input['ids'] as $appId) {
        $appId = (int)$appId;
        if ($appId <= 0) continue;

        // Fetch application
        $stmt = $pdo->prepare('SELECT * FROM applications WHERE id = ? LIMIT 1');
        $stmt->execute([$appId]);
        $app = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$app) {
            $failedIds[] = $appId;
            continue;
        }

        $allowed = false;

        if ($isAdmin) $allowed = true;

        // Employer can delete applications for their internships
        if (!$allowed && $isEmployer) {
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
            $failedIds[] = $appId;
            continue;
        }

        // Remove resume file if present
        if (!empty($app['resume_path'])) {
            $path = __DIR__ . '/../' . ltrim($app['resume_path'], '/\\');
            if (file_exists($path)) @unlink($path);
        }

        // Delete application
        $d = $pdo->prepare('DELETE FROM applications WHERE id = ?');
        $d->execute([$appId]);
        $deletedIds[] = $appId;
    }

    echo json_encode(['success' => true, 'deleted_ids' => $deletedIds, 'failed_ids' => $failedIds]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit;
}

?>
