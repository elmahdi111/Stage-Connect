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

try {
    $user = isset($_SESSION['user']) ? $_SESSION['user'] : null;
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }

    // Allowed fields for insert
    $allowed = ['hotel','location','title_ar','title_fr','title_en','type_ar','type_fr','type_en','duration_ar','duration_fr','duration_en','rating','image','description_ar','description_fr','description_en','start_date'];
    $fields = [];
    $placeholders = [];
    $params = [];
    foreach ($allowed as $k) {
        if (isset($data[$k])) {
            $fields[] = "`$k`";
            $placeholders[] = '?';
            $params[] = $data[$k];
        }
    }

    // Handle image upload
    $imageUrl = null;
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
        
        // Generate unique filename
        $newFileName = 'offer_' . time() . '_' . uniqid() . '.' . $ext;
        $filePath = $uploadDir . $newFileName;
        
        if (move_uploaded_file($file['tmp_name'], $filePath)) {
            $imageUrl = 'uploads/internships/' . $newFileName;
        }
    }

    if ($imageUrl) {
        $fields[] = '`image`';
        $placeholders[] = '?';
        $params[] = $imageUrl;
    }

    // If employer_id column exists, set it; otherwise set hotel from user name if not provided
    $hasEmployerId = false;
    try {
        $c = $pdo->query("SHOW COLUMNS FROM internships LIKE 'employer_id'");
        $hasEmployerId = ($c->rowCount() > 0);
    } catch (Exception $e) {
        $hasEmployerId = false;
    }

    if ($hasEmployerId) {
        $fields[] = '`employer_id`';
        $placeholders[] = '?';
        $params[] = (int)$user['id'];
    } else {
        // ensure hotel value exists for fallback ownership matching
        if (!in_array('`hotel`', $fields)) {
            $fields[] = '`hotel`';
            $placeholders[] = '?';
            $params[] = $user['name'];
        }
    }

    if (count($fields) === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No fields provided']);
        exit;
    }

    $sql = 'INSERT INTO internships (' . implode(', ', $fields) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $id = $pdo->lastInsertId();
    echo json_encode(['success' => true, 'id' => (int)$id]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

