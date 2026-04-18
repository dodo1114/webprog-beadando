<?php

declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($uri === '/') {
    $indexPath = __DIR__ . '/public/index.html';
    if (is_file($indexPath)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($indexPath);
        return true;
    }
}

$filePath = __DIR__ . '/public' . $uri;
if (is_file($filePath)) {
    return false;
}

require __DIR__ . '/public/index.php';
