<?php
// api/notification_preferences.php
// Notifications have been disabled per user request. Return a disabled response.
header('Content-Type: application/json; charset=utf-8');
http_response_code(410);
echo json_encode(['success'=>false,'error'=>'Notification preferences are disabled']);
