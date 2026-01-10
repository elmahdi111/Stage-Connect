<?php
// Reset user password - for testing/admin purposes
require_once __DIR__ . '/config.php';

$email = isset($_GET['email']) ? trim($_GET['email']) : null;
$newPassword = isset($_GET['password']) ? $_GET['password'] : null;

if (!$email || !$newPassword) {
    echo "Usage: test_reset_password.php?email=user@example.com&password=newpassword\n";
    echo "\nExample:\n";
    echo "test_reset_password.php?email=elmahdiaguenrid@gmail.com&password=12345678\n";
    exit;
}

try {
    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
    $stmt->execute([$newHash, $email]);
    
    if ($stmt->rowCount() > 0) {
        echo "✓ Password reset successfully for: $email\n";
        echo "New password: $newPassword\n";
    } else {
        echo "✗ User not found: $email\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
