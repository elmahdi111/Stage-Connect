<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
if (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
    echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
} else {
    echo json_encode(['success' => false, 'user' => null]);
}
