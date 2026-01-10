<?php
// tools/create_admin.php
// Usage: run `php tools/create_admin.php` from project root (requires PHP CLI)
// It will insert or update an admin user with email nourddin@admin.com and password admin@123

require_once __DIR__ . '/../api/config.php';

$name = 'admin';
$email = 'nourddin@admin.com';
$password = 'admin@123';
$type = 'employer';
$is_admin = 1;

try {
    // Check existing
    $st = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $st->execute([$email]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($row) {
        $id = (int)$row['id'];
        $up = $pdo->prepare('UPDATE users SET name = ?, password_hash = ?, type = ?, is_admin = ?, updated_at = NOW() WHERE id = ?');
        $up->execute([$name, $hash, $type, $is_admin, $id]);
        echo "Updated existing admin (id={$id})\n";
    } else {
        $ins = $pdo->prepare('INSERT INTO users (name,email,password_hash,type,is_admin,created_at) VALUES (?, ?, ?, ?, ?, NOW())');
        $ins->execute([$name, $email, $hash, $type, $is_admin]);
        $id = $pdo->lastInsertId();
        echo "Inserted admin (id={$id})\n";
    }
    echo "Admin credentials:\n  email: {$email}\n  password: {$password}\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

?>