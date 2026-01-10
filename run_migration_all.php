<?php
// run_migration_all.php
// Execute all .sql files in db/migrations in alphabetical order using existing PDO config
require_once __DIR__ . '/api/config.php';

$dir = __DIR__ . '/db/migrations';
if (!is_dir($dir)) {
    echo "Migrations directory not found: $dir\n";
    exit(1);
}
$files = glob($dir . '/*.sql');
if (!$files) {
    echo "No migration files found in $dir\n";
    exit(0);
}
sort($files);
try {
    foreach ($files as $path) {
        echo "Applying migration: $path\n";
        $sql = file_get_contents($path);
        if (!$sql) continue;
        $stmts = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($stmts as $s) {
            if ($s === '') continue;
            $pdo->exec($s);
        }
    }
    echo "All migrations applied.\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
