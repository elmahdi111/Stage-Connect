<?php
// Test login to verify password verification works
require_once __DIR__ . '/config.php';

// Test with known user
$testEmail = 'elmahdiaguenrid@gmail.com';
$testPassword = '12345678'; // We don't know the actual password

try {
    $stmt = $pdo->prepare('SELECT id, name, email, password_hash, type FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$testEmail]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo "User not found: $testEmail\n";
    } else {
        echo "User found: {$user['name']} ({$user['email']})\n";
        echo "User type: {$user['type']}\n";
        echo "Password hash: {$user['password_hash']}\n";
        
        // Test password verification
        $verified = password_verify($testPassword, $user['password_hash']);
        echo "Password '$testPassword' verification: " . ($verified ? "SUCCESS" : "FAILED") . "\n";
        
        // Try to create new hash and compare
        $newHash = password_hash($testPassword, PASSWORD_DEFAULT);
        echo "New hash would be: $newHash\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
