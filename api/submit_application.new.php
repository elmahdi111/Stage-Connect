<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../lib/NotificationService2.php';

header('Content-Type: application/json; charset=utf-8');

// Accept POST form-data or JSON
$data = $_POST;
if (empty($data)) {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) $data = $json;
}

$internship_id = isset($data['internship_id']) ? (int)$data['internship_id'] : null;
$name = isset($data['name']) ? trim($data['name']) : null;
$email = isset($data['email']) ? trim($data['email']) : null;
$phone = isset($data['phone']) ? trim($data['phone']) : null;
$school = isset($data['school']) ? trim($data['school']) : null;

if (!$name || !$email) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields (name, email)']);
    exit;
}

try {
    // handle file upload (resume)
    $resumePath = null;
    if (isset($_FILES['resume']) && $_FILES['resume']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../uploads/resumes/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $ext = pathinfo($_FILES['resume']['name'], PATHINFO_EXTENSION);
        $safeExt = preg_replace('/[^a-zA-Z0-9]/', '', $ext);
        $filename = uniqid('resume_') . '.' . ($safeExt ?: 'pdf');
        $target = $uploadDir . $filename;
        if (!move_uploaded_file($_FILES['resume']['tmp_name'], $target)) {
            // proceed without resume on failure
            $resumePath = null;
        } else {
            $resumePath = 'uploads/resumes/' . $filename;
        }
    }

    $date = date('Y-m-d');
    $extra = isset($data['extra']) && is_array($data['extra']) ? json_encode($data['extra'], JSON_UNESCAPED_UNICODE) : null;
    $status = 'pending';
    try {
        // Try inserting with resume_path (if the column exists)
        $stmt = $pdo->prepare('INSERT INTO applications (internship_id, applicant_name, email, phone, school, date_applied, status, extra, resume_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$internship_id, $name, $email, $phone, $school, $date, $status, $extra, $resumePath]);
    } catch (Exception $e) {
        // Fallback: insert without resume_path (older schema)
        try {
            $stmt = $pdo->prepare('INSERT INTO applications (internship_id, applicant_name, email, phone, school, date_applied, status, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$internship_id, $name, $email, $phone, $school, $date, $status, $extra]);
            // nullify resumePath to indicate it wasn't saved
            $resumePath = null;
        } catch (Exception $e2) {
            throw $e2; // rethrow so outer catch handles it
        }
    }

    // application inserted, attempt to notify hotel/employer
    $applicationId = $pdo->lastInsertId();

    try {
        // Find internship to determine hotel name
        $hotelName = null;
        if ($internship_id) {
            $q = $pdo->prepare('SELECT hotel FROM internships WHERE id = ? LIMIT 1');
            $q->execute([$internship_id]);
            $row = $q->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['hotel'])) $hotelName = $row['hotel'];
        }

        // Map hotel name to a user (employer) account by matching users.name
        if ($hotelName) {
            $u = $pdo->prepare('SELECT id FROM users WHERE name = ? AND type = ? LIMIT 1');
            $u->execute([$hotelName, 'employer']);
            $userRow = $u->fetch(PDO::FETCH_ASSOC);
            if ($userRow && !empty($userRow['id'])) {
                $hotelUserId = (int)$userRow['id'];

                $svc = new NotificationService($pdo);
                $payload = [
                    'type' => 'new_application',
                    'title' => 'New application received',
                    'body' => "New application for internship #{$internship_id} by {$name}",
                    'data' => [
                        'application_id' => $applicationId,
                        'internship_id' => $internship_id,
                    ],
                ];
                // actor id unknown (applicant may not be a logged-in user), pass null
                $svc->notify([$hotelUserId], $payload, null);
            }
        }
    } catch (Exception $notifyEx) {
        // swallow notification errors so they don't affect main response
    }

    echo json_encode(['success' => true, 'id' => $applicationId, 'resume_path' => $resumePath]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
