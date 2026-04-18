<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (str_starts_with($path, '/web1/')) {
    $path = substr($path, strlen('/web1'));
}

if ($path === '/web1') {
    $path = '/';
}

if ($path === '/api/v1/health' && $method === 'GET') {
    http_response_code(200);
    echo json_encode([
        'status' => 'ok',
        'service' => 'webprog-assignment',
        'phase' => 'scaffold',
        'time_utc' => gmdate('c'),
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

if (str_starts_with($path, '/api/v1/')) {
    http_response_code(501);
    echo json_encode([
        'error' => 'not_implemented',
        'message' => 'API scaffold exists, implementation is still in progress.',
        'path' => $path,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code(404);
echo json_encode([
    'error' => 'not_found',
    'path' => $path,
], JSON_UNESCAPED_SLASHES);
