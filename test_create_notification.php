<?php
// test_create_notification.php
// Usage (CLI): php test_create_notification.php [recipient_id] [actor_id]
// If run from browser, it will use session user if available.

require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/lib/NotificationService2.php';
session_start();

$recipient = null;
$actorId = null;
if (php_sapi_name() === 'cli') {
    $recipient = isset($argv[1]) ? (int)$argv[1] : null;
    $actorId = isset($argv[2]) ? (int)$argv[2] : null;
} else {
    $input = $_POST ?: json_decode(file_get_contents('php://input'), true) ?: [];
    $recipient = isset($input['recipient_id']) ? (int)$input['recipient_id'] : null;
    $actorId = isset($input['actor_id']) ? (int)$input['actor_id'] : null;
}

if (!$recipient) {
    // fall back to session user if available, otherwise default to 1
    if (isset($_SESSION['user']) && isset($_SESSION['user']['id'])) $recipient = (int)$_SESSION['user']['id'];
    else $recipient = 1;
}

$svc = new NotificationService($pdo);
$payload = [
    'type' => 'test',
    'title' => 'Test notification',
    'body' => 'This is a test notification created by test_create_notification.php',
    'data' => ['created_by' => 'test_script']
];

$created = $svc->notify([$recipient], $payload, $actorId);

if (php_sapi_name() === 'cli') {
    echo "Created notifications: " . json_encode($created) . PHP_EOL;
} else {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'created' => $created]);
}
