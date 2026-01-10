<?php
// Test script to check and create test users
require_once __DIR__ . '/config.php';

try {
    // Check if users table exists and has data
    $stmt = $pdo->query('SELECT COUNT(*) as count FROM users');
    $result = $stmt->fetch();
    $userCount = $result['count'];
    
    echo "Current user count: $userCount\n";
    
    if ($userCount === 0) {
        echo "No users found. Creating test users...\n";
        
        // Create test trainee user
        $traineeEmail = 'trainee@example.com';
        $traineePassword = '12345678';
        $traineeHash = password_hash($traineePassword, PASSWORD_DEFAULT);
        
        $ins = $pdo->prepare('INSERT INTO users (name, email, password_hash, type) VALUES (?, ?, ?, ?)');
        $ins->execute(['Test Trainee', $traineeEmail, $traineeHash, 'trainee']);
        echo "✓ Created trainee user: $traineeEmail / $traineePassword\n";
        
        // Create test employer user
        $employerEmail = 'hotel@example.com';
        $employerPassword = '12345678';
        $employerHash = password_hash($employerPassword, PASSWORD_DEFAULT);
        
        $ins->execute(['Test Hotel', $employerEmail, $employerHash, 'employer']);
        echo "✓ Created employer user: $employerEmail / $employerPassword\n";
    } else {
        echo "Users already exist in database.\n";
        $stmt = $pdo->query('SELECT id, name, email, type FROM users LIMIT 10');
        $users = $stmt->fetchAll();
        foreach ($users as $user) {
            echo "- {$user['name']} ({$user['email']}) - Type: {$user['type']}\n";
        }
    }
    
    echo "\nDone!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
