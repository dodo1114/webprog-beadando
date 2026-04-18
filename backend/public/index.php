<?php

declare(strict_types=1);

use App\SoftwareRepository;

require_once dirname(__DIR__) . '/src/SoftwareRepository.php';

header('Content-Type: application/json; charset=utf-8');

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if (str_starts_with($path, '/web1/')) {
    $path = substr($path, strlen('/web1'));
}

if ($path === '/web1') {
    $path = '/';
}

if ($path === '/api/v1/health' && $method === 'GET') {
    try {
        $connectionInfo = repository()->getConnectionInfo();
    } catch (RuntimeException $exception) {
        respond(500, [
            'status' => 'error',
            'service' => 'webprog-assignment',
            'phase' => 'mysql-crud',
            'message' => $exception->getMessage(),
        ]);
    }

    respond(200, [
        'status' => 'ok',
        'service' => 'webprog-assignment',
        'phase' => 'mysql-crud',
        'storage' => 'mysql',
        'table' => $connectionInfo['table'],
        'time_utc' => gmdate('c'),
    ]);
}

if ($path === '/api/v1/software' && $method === 'GET') {
    try {
        respond(200, [
            'items' => repository()->getAll(),
        ]);
    } catch (RuntimeException $exception) {
        respond(500, [
            'error' => 'storage_error',
            'message' => $exception->getMessage(),
        ]);
    }
}

if ($path === '/api/v1/software' && $method === 'POST') {
    $payload = readJsonPayload();
    $name = normalizeField($payload, 'nev');
    $category = normalizeField($payload, 'kategoria');

    if ($name === '' || $category === '') {
        respond(422, [
            'error' => 'validation_failed',
            'message' => 'A név és a kategória megadása kötelező.',
        ]);
    }

    try {
        $created = repository()->create($name, $category);
        respond(201, [
            'message' => 'A szoftver sikeresen létrejött.',
            'item' => $created,
        ]);
    } catch (RuntimeException $exception) {
        respond(500, [
            'error' => 'storage_error',
            'message' => $exception->getMessage(),
        ]);
    }
}

if (preg_match('#^/api/v1/software/(\d+)$#', $path, $matches) === 1) {
    $id = (int)$matches[1];

    try {
        if ($method === 'GET') {
            $item = repository()->find($id);
            if ($item === null) {
                respond(404, [
                    'error' => 'not_found',
                    'message' => 'A keresett szoftver nem található.',
                ]);
            }

            respond(200, ['item' => $item]);
        }

        if ($method === 'PATCH') {
            $payload = readJsonPayload();
            $name = normalizeField($payload, 'nev');
            $category = normalizeField($payload, 'kategoria');

            if ($name === '' || $category === '') {
                respond(422, [
                    'error' => 'validation_failed',
                    'message' => 'A név és a kategória megadása kötelező.',
                ]);
            }

            $updated = repository()->update($id, $name, $category);
            if ($updated === null) {
                respond(404, [
                    'error' => 'not_found',
                    'message' => 'A frissíteni kívánt szoftver nem található.',
                ]);
            }

            respond(200, [
                'message' => 'A szoftver sikeresen frissült.',
                'item' => $updated,
            ]);
        }

        if ($method === 'DELETE') {
            $deleted = repository()->delete($id);
            if ($deleted === null) {
                respond(404, [
                    'error' => 'not_found',
                    'message' => 'A törölni kívánt szoftver nem található.',
                ]);
            }

            respond(200, [
                'message' => 'A szoftver törölve lett.',
                'item' => $deleted,
            ]);
        }
    } catch (RuntimeException $exception) {
        respond(500, [
            'error' => 'storage_error',
            'message' => $exception->getMessage(),
        ]);
    }
}

if (str_starts_with($path, '/api/v1/')) {
    respond(405, [
        'error' => 'method_or_route_not_supported',
        'message' => 'Ez az API útvonal vagy HTTP metódus nincs támogatva.',
        'path' => $path,
        'method' => $method,
    ]);
}

respond(404, [
    'error' => 'not_found',
    'path' => $path,
]);

function respond(int $statusCode, array $payload): never
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readJsonPayload(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        respond(400, [
            'error' => 'invalid_json',
            'message' => 'A kérés törzse nem értelmezhető JSON formátumként.',
        ]);
    }

    if (!is_array($decoded)) {
        respond(400, [
            'error' => 'invalid_payload',
            'message' => 'A kérés törzsének JSON objektumnak kell lennie.',
        ]);
    }

    return $decoded;
}

function normalizeField(array $payload, string $field): string
{
    return trim((string)($payload[$field] ?? ''));
}

function repository(): SoftwareRepository
{
    static $repository = null;

    if ($repository instanceof SoftwareRepository) {
        return $repository;
    }

    $repository = new SoftwareRepository(
        dirname(__DIR__) . '/.env',
        __DIR__ . '/data/software.json',
    );

    return $repository;
}
