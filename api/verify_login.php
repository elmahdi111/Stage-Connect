<?php
require_once __DIR__ . '/config.php';

$email = 'elmahdiaguenrid@gmail.com';
$password = '12345678';

$stmt = $pdo->prepare('SELECT password_hash, type FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    $verified = password_verify($password, $user['password_hash']);
    echo "Email: $email\n";
    echo "Type: {$user['type']}\n";
    echo "Password verification: " . ($verified ? "✓ SUCCESS" : "✗ FAILED") . "\n";
} else {
    echo "User not found\n";
}
?>
