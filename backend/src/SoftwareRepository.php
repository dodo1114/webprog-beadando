<?php

declare(strict_types=1);

namespace App;

use PDO;
use PDOException;
use RuntimeException;

final class SoftwareRepository
{
    private PDO $pdo;
    private string $table;

    public function __construct(
        private readonly string $envPath,
        private readonly string $seedPath,
    ) {
        $config = $this->readConfig();
        $this->table = $config['DB_TABLE'] ?? 'software_items';

        try {
            $this->pdo = new PDO(
                $config['DB_DSN'] ?? '',
                $config['DB_USER'] ?? '',
                $config['DB_PASSWORD'] ?? '',
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]
            );
        } catch (PDOException $exception) {
            throw new RuntimeException('Az adatbázis-kapcsolat nem hozható létre: ' . $exception->getMessage(), 0, $exception);
        }

        $this->ensureSchema();
        $this->seedIfEmpty();
    }

    /**
     * @return array<int, array{id:int, nev:string, kategoria:string}>
     */
    public function getAll(): array
    {
        $statement = $this->pdo->query(
            "SELECT id, nev, kategoria
             FROM {$this->table}
             ORDER BY nev ASC, id ASC"
        );

        return $this->normalizeRows($statement->fetchAll());
    }

    public function find(int $id): ?array
    {
        $statement = $this->pdo->prepare(
            "SELECT id, nev, kategoria
             FROM {$this->table}
             WHERE id = :id"
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch();
        return $row === false ? null : $this->normalizeRow($row);
    }

    public function create(string $name, string $category): array
    {
        $statement = $this->pdo->prepare(
            "INSERT INTO {$this->table} (nev, kategoria)
             VALUES (:nev, :kategoria)"
        );
        $statement->execute([
            'nev' => $name,
            'kategoria' => $category,
        ]);

        return $this->find((int)$this->pdo->lastInsertId()) ?? [
            'id' => (int)$this->pdo->lastInsertId(),
            'nev' => $name,
            'kategoria' => $category,
        ];
    }

    public function update(int $id, string $name, string $category): ?array
    {
        $statement = $this->pdo->prepare(
            "UPDATE {$this->table}
             SET nev = :nev, kategoria = :kategoria
             WHERE id = :id"
        );
        $statement->execute([
            'id' => $id,
            'nev' => $name,
            'kategoria' => $category,
        ]);

        if ($statement->rowCount() === 0 && $this->find($id) === null) {
            return null;
        }

        return $this->find($id);
    }

    public function delete(int $id): ?array
    {
        $existing = $this->find($id);
        if ($existing === null) {
            return null;
        }

        $statement = $this->pdo->prepare(
            "DELETE FROM {$this->table}
             WHERE id = :id"
        );
        $statement->execute(['id' => $id]);

        return $existing;
    }

    public function getConnectionInfo(): array
    {
        return [
            'table' => $this->table,
        ];
    }

    private function ensureSchema(): void
    {
        $sql = <<<SQL
CREATE TABLE IF NOT EXISTS {$this->table} (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nev VARCHAR(255) NOT NULL,
    kategoria VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci
SQL;

        $this->pdo->exec($sql);
    }

    private function seedIfEmpty(): void
    {
        $statement = $this->pdo->query("SELECT COUNT(*) FROM {$this->table}");
        $count = (int)$statement->fetchColumn();
        if ($count > 0) {
            return;
        }

        $seedItems = $this->loadSeedItems();
        if ($seedItems === []) {
            return;
        }

        $insert = $this->pdo->prepare(
            "INSERT INTO {$this->table} (id, nev, kategoria)
             VALUES (:id, :nev, :kategoria)"
        );

        foreach ($seedItems as $item) {
            $insert->execute([
                'id' => $item['id'],
                'nev' => $item['nev'],
                'kategoria' => $item['kategoria'],
            ]);
        }

        $maxId = max(array_column($seedItems, 'id'));
        $this->pdo->exec("ALTER TABLE {$this->table} AUTO_INCREMENT = " . ((int)$maxId + 1));
    }

    /**
     * @return array<string, string>
     */
    private function readConfig(): array
    {
        if (!is_file($this->envPath)) {
            throw new RuntimeException('A backend/.env fájl hiányzik, ezért az adatbázis nem konfigurálható.');
        }

        $lines = file($this->envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            throw new RuntimeException('A backend/.env fájl nem olvasható.');
        }

        $config = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            [$key, $value] = array_pad(explode('=', $trimmed, 2), 2, '');
            $config[trim($key)] = trim($value);
        }

        if (($config['DB_DSN'] ?? '') === '') {
            throw new RuntimeException('A DB_DSN érték hiányzik a backend/.env fájlból.');
        }

        return $config;
    }

    /**
     * @return array<int, array{id:int, nev:string, kategoria:string}>
     */
    private function loadSeedItems(): array
    {
        if (!is_file($this->seedPath)) {
            return [];
        }

        $contents = file_get_contents($this->seedPath);
        if ($contents === false) {
            throw new RuntimeException('A seed adatfájl nem olvasható.');
        }

        $decoded = json_decode($contents, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('A seed JSON nem értelmezhető.');
        }

        return $this->normalizeRows($decoded);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array{id:int, nev:string, kategoria:string}>
     */
    private function normalizeRows(array $rows): array
    {
        $normalized = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $normalizedRow = $this->normalizeRow($row);
            if ($normalizedRow !== null) {
                $normalized[] = $normalizedRow;
            }
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $row
     * @return array{id:int, nev:string, kategoria:string}|null
     */
    private function normalizeRow(array $row): ?array
    {
        $id = (int)($row['id'] ?? 0);
        $name = trim((string)($row['nev'] ?? ''));
        $category = trim((string)($row['kategoria'] ?? ''));

        if ($id <= 0 || $name === '' || $category === '') {
            return null;
        }

        return [
            'id' => $id,
            'nev' => $name,
            'kategoria' => $category,
        ];
    }
}
