<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

if (!isset($_SESSION['user'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$me = $_SESSION['user'];
if (!isset($me['type']) || $me['type'] !== 'employer') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Only employers can delete offers']);
    exit;
}

try {
    // Find internships by employer
    $hasEmployerId = false;
    try {
        $col = $pdo->query("SHOW COLUMNS FROM internships LIKE 'employer_id'")->fetch();
        if ($col) $hasEmployerId = true;
    } catch (Exception $e) { }

    $internships = [];
    if ($hasEmployerId) {
        $stmt = $pdo->prepare('SELECT id FROM internships WHERE employer_id = ?');
        $stmt->execute([$me['id']]);
    } else {
        $stmt = $pdo->prepare('SELECT id FROM internships WHERE hotel = ?');
        $stmt->execute([$me['name']]);
    }
    $internships = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $deletedCount = 0;

    // For each internship, delete applications and remove resume files
    foreach ($internships as $it) {
        $iid = (int)$it['id'];
        
        // Get applications for this internship and delete resume files
        try {
            $apps = $pdo->prepare('SELECT id, resume_path FROM applications WHERE internship_id = ?');
            $apps->execute([$iid]);
            foreach ($apps->fetchAll(PDO::FETCH_ASSOC) as $a) {
                if (!empty($a['resume_path'])) {
                    $path = __DIR__ . '/../' . ltrim($a['resume_path'], '/\\');
                    if (file_exists($path)) @unlink($path);
                }
            }
            $pdo->prepare('DELETE FROM applications WHERE internship_id = ?')->execute([$iid]);
        } catch (Exception $e) { /* ignore */ }

        // Delete notifications referencing this internship
        try {
            $like = '%"internship_id":' . $iid . '%';
            $pdo->prepare('DELETE FROM notifications WHERE data LIKE ?')->execute([$like]);
        } catch (Exception $e) { /* ignore */ }

        // Delete the internship
        try {
            $pdo->prepare('DELETE FROM internships WHERE id = ?')->execute([$iid]);
            $deletedCount++;
        } catch (Exception $e) { /* ignore */ }
    }

    echo json_encode(['success' => true, 'deleted_internships' => $deletedCount]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    exit;
}

?>
