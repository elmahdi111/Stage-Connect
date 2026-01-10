<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../lib/NotificationService2.php';

session_start();

header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) $data = $_POST;

$id = isset($data['id']) ? (int)$data['id'] : null;
$status = isset($data['status']) ? $data['status'] : null;

if (!$id || !in_array($status, ['pending','approved','rejected'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid parameters']);
    exit;
}

try {
    $stmt = $pdo->prepare('UPDATE applications SET status = ? WHERE id = ?');
    $stmt->execute([$status, $id]);

    // Fetch application to identify trainee (user_id) and internship
    try {
        $s = $pdo->prepare('SELECT id, user_id, internship_id, applicant_name, email FROM applications WHERE id = ? LIMIT 1');
        $s->execute([$id]);
        $app = $s->fetch(PDO::FETCH_ASSOC);
        if ($app && !empty($app['user_id'])) {
            $recipientId = (int)$app['user_id'];
            $svc = new NotificationService($pdo);
            $actorId = isset($_SESSION['user']['id']) ? (int)$_SESSION['user']['id'] : null;
            $payload = [
                'type' => 'application_status',
                'title' => 'Application status updated',
                'body' => "Your application status changed to {$status}",
                'data' => [
                    'application_id' => $id,
                    'internship_id' => $app['internship_id'] ?? null,
                    'new_status' => $status,
                ],
            ];
            try {
                $svc->notify([$recipientId], $payload, $actorId);
            } catch (Exception $nex) {
                // Do not fail the request if notification fails
            }
        }
    } catch (Exception $e2) {
        // ignore notification errors
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
