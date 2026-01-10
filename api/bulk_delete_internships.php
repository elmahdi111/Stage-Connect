<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

if (!isset($_SESSION['user']) || empty($_SESSION['user']['is_admin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['ids']) || !is_array($input['ids'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing or invalid ids']);
    exit;
}

try {
    $deletedCount = 0;

    foreach ($input['ids'] as $offerId) {
        $offerId = (int)$offerId;
        if ($offerId <= 0) continue;

        // Get applications for this internship and delete resume files
        try {
            $apps = $pdo->prepare('SELECT id, resume_path FROM applications WHERE internship_id = ?');
            $apps->execute([$offerId]);
            foreach ($apps->fetchAll(PDO::FETCH_ASSOC) as $a) {
                if (!empty($a['resume_path'])) {
                    $path = __DIR__ . '/../' . ltrim($a['resume_path'], '/\\');
                    if (file_exists($path)) @unlink($path);
                }
            }
            $pdo->prepare('DELETE FROM applications WHERE internship_id = ?')->execute([$offerId]);
        } catch (Exception $e) { /* ignore */ }

        // Delete notifications referencing this internship
        try {
            $like = '%"internship_id":' . $offerId . '%';
            $pdo->prepare('DELETE FROM notifications WHERE data LIKE ?')->execute([$like]);
        } catch (Exception $e) { /* ignore */ }

        // Delete the internship
        try {
            $pdo->prepare('DELETE FROM internships WHERE id = ?')->execute([$offerId]);
            $deletedCount++;
        } catch (Exception $e) { /* ignore */ }
    }

    echo json_encode(['success' => true, 'deleted_count' => $deletedCount]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit;
}

?>
