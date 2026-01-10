<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

session_start();

// Optional filter: internship_id
$internship_id = isset($_GET['internship_id']) ? (int)$_GET['internship_id'] : null;

try {
    $user = isset($_SESSION['user']) ? $_SESSION['user'] : null;
    
    // Employers: return applications for their hotel's internships only
    if ($user && isset($user['type']) && $user['type'] === 'employer' && empty($user['is_admin'])) {
        // Use the hotel's name (stored in the user's `name` field) to filter internships
        $hotelName = $user['name'];
        if ($internship_id) {
            $stmt = $pdo->prepare('SELECT a.* FROM applications a LEFT JOIN internships i ON a.internship_id = i.id WHERE i.hotel = ? AND a.internship_id = ? ORDER BY a.date_applied DESC');
            $stmt->execute([$hotelName, $internship_id]);
        } else {
            $stmt = $pdo->prepare('SELECT a.* FROM applications a LEFT JOIN internships i ON a.internship_id = i.id WHERE i.hotel = ? ORDER BY a.date_applied DESC');
            $stmt->execute([$hotelName]);
        }
    } 
    // Trainees: return only their own applications
    else if ($user && isset($user['type']) && $user['type'] === 'trainee') {
        $userId = $user['id'];
        if ($internship_id) {
            $stmt = $pdo->prepare('SELECT * FROM applications WHERE user_id = ? AND internship_id = ? ORDER BY date_applied DESC');
            $stmt->execute([$userId, $internship_id]);
        } else {
            $stmt = $pdo->prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY date_applied DESC');
            $stmt->execute([$userId]);
        }
    }
    // Other / admin handling:
    else {
        // Only allow full view for admins; otherwise return no applications
        if ($user && isset($user['type']) && $user['type'] === 'admin') {
            if ($internship_id) {
                $stmt = $pdo->prepare('SELECT * FROM applications WHERE internship_id = ? ORDER BY date_applied DESC');
                $stmt->execute([$internship_id]);
            } else {
                $stmt = $pdo->query('SELECT * FROM applications ORDER BY date_applied DESC');
            }
        } else {
            // Not an authenticated trainee/employer/admin: return empty list
            echo json_encode(['success' => true, 'data' => []]);
            exit;
        }
    }

    $rows = $stmt->fetchAll();
    echo json_encode(['success' => true, 'data' => $rows]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
