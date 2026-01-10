<?php
require_once __DIR__ . '/config.php';

$users = [
    ['email' => 'elmahdiaguenrid@gmail.com', 'password' => '12345678', 'type' => 'trainee'],
    ['email' => 'hoteltabanna@gmail.com', 'password' => '12345678', 'type' => 'employer'],
    ['email' => 'everything@gmail.com', 'password' => '12345678', 'type' => 'trainee'],
    ['email' => 'nourddin@admin.com', 'password' => '12345678', 'type' => 'employer']
];

foreach ($users as $u) {
    $hash = password_hash($u['password'], PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
    $stmt->execute([$hash, $u['email']]);
    echo "✓ Updated: {$u['email']} password: {$u['password']}\n";
}

echo "\nTest credentials:\n";
echo "Trainee: elmahdiaguenrid@gmail.com / 12345678\n";
echo "Hotel: hoteltabanna@gmail.com / 12345678\n";
?>
