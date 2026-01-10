<?php
require 'api/config.php';
// Update record 11 with proper multilingual values
$pdo->prepare('UPDATE internships SET title_ar = ?, title_fr = ?, type_ar = ?, type_fr = ? WHERE id = 11')
    ->execute(['عنوان', 'Titre', 'Serveur/Serveuse', 'Serveur/Serveuse']);
echo "Updated record 11\n";
?>
