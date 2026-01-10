<?php
// api/notifications/read.php
// Notifications have been disabled per user request.
header('Content-Type: application/json; charset=utf-8');
http_response_code(410);
echo json_encode(['success'=>false,'error'=>'Notifications are disabled']);
