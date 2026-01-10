<?php
// run_migration.php
// Runs the SQL in db/migrations/20251130_create_notifications.sql using the existing PDO config

require_once __DIR__ . '/api/config.php';

$path = __DIR__ . '/db/migrations/20251130_create_notifications.sql';
if (!file_exists($path)) {
    echo "Migration file not found: $path\n";
    exit(1);
}

$sql = file_get_contents($path);
if (!$sql) {
    echo "Failed to read migration file\n";
    exit(1);
}

try {
    // Split statements by semicolon and execute individually
    $stmts = array_filter(array_map('trim', explode(';', $sql)));
    foreach ($stmts as $s) {
        if ($s === '') continue;
        $pdo->exec($s);
    }
    echo "Migration executed successfully.\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
