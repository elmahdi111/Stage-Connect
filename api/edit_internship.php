<?php
require_once __DIR__ . '/config.php';
session_start();

header('Content-Type: application/json; charset=utf-8');

// Accept both JSON and multipart/form-data
$data = [];
if ($_SERVER['CONTENT_TYPE'] && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? [];
} else {
    $data = $_POST;
}

$id = isset($data['id']) ? (int)$data['id'] : 0;
if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing internship id']);
    exit;
}

try {
    // fetch internship
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

    // ownership check: if internships has employer_id use it; otherwise fallback to hotel name match
    $isOwner = false;
    if (isset($row['employer_id']) && $row['employer_id']) {
        if ((int)$row['employer_id'] === (int)$user['id'] || ($user['is_admin'] ?? 0)) $isOwner = true;
    } else {
        // fallback: employer's user.name should equal internship.hotel
        if ($user['type'] === 'employer' && $user['name'] === $row['hotel']) $isOwner = true;
        if ($user['is_admin'] ?? 0) $isOwner = true;
    }

    if (!$isOwner) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not allowed']);
        exit;
    }

    // Build update dynamically from allowed fields
    $allowed = ['hotel','location','title_ar','title_fr','title_en','type_ar','type_fr','type_en','duration_ar','duration_fr','duration_en','rating','image','description_ar','description_fr','description_en','start_date'];
    $sets = [];
    $params = [];
    foreach ($allowed as $k) {
        if (isset($data[$k])) {
            $sets[] = "`$k` = ?";
            $params[] = $data[$k];
        }
    }

    // Handle image upload
    if (isset($_FILES['image_file']) && $_FILES['image_file']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['image_file'];
        $fileName = basename($file['name']);
        $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        // Validate extension
        if (!in_array($ext, ['jpg','jpeg','png','gif','webp'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid image format']);
            exit;
        }
        
        // Create upload directory if not exists
        $uploadDir = __DIR__ . '/../uploads/internships/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        // Delete old image if exists
        if ($row['image'] && file_exists(__DIR__ . '/../' . $row['image'])) {
            @unlink(__DIR__ . '/../' . $row['image']);
        }
        
        // Generate unique filename
        $newFileName = 'offer_' . time() . '_' . uniqid() . '.' . $ext;
        $filePath = $uploadDir . $newFileName;
        
        if (move_uploaded_file($file['tmp_name'], $filePath)) {
            $imageUrl = 'uploads/internships/' . $newFileName;
            $sets[] = '`image` = ?';
            $params[] = $imageUrl;
        }
    }

    if (count($sets) === 0) {
        echo json_encode(['success' => true, 'message' => 'No changes']);
        exit;
    }

    $params[] = $id;
    $sql = 'UPDATE internships SET ' . implode(', ', $sets) . ' WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}


