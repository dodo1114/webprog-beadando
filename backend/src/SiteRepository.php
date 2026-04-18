<?php

declare(strict_types=1);

namespace App;

use PDO;
use PDOException;
use RuntimeException;

final class SiteRepository
{
    private PDO $pdo;

    public function __construct(private readonly string $envPath)
    {
        $config = $this->readConfig();

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
            throw new RuntimeException('Az oldalhoz szükséges adatbázis-kapcsolat nem hozható létre: ' . $exception->getMessage(), 0, $exception);
        }

        $this->ensureSchema();
        $this->seedDefaultUser();
        $this->seedGalleryIfEmpty();
    }

    public function getUserById(int $id): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, family_name, given_name, login_name
             FROM users
             WHERE id = :id'
        );
        $statement->execute(['id' => $id]);

        $row = $statement->fetch();
        return $row === false ? null : $this->normalizeUser($row);
    }

    public function authenticate(string $loginName, string $password): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, family_name, given_name, login_name, password_hash
             FROM users
             WHERE login_name = :login_name'
        );
        $statement->execute(['login_name' => $loginName]);

        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }

        if (!password_verify($password, (string)$row['password_hash'])) {
            return null;
        }

        return $this->normalizeUser($row);
    }

    public function registerUser(string $familyName, string $givenName, string $loginName, string $password): array
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM users WHERE login_name = :login_name');
        $statement->execute(['login_name' => $loginName]);

        if ((int)$statement->fetchColumn() > 0) {
            throw new RuntimeException('Ez a login név már foglalt.');
        }

        $insert = $this->pdo->prepare(
            'INSERT INTO users (family_name, given_name, login_name, password_hash)
             VALUES (:family_name, :given_name, :login_name, :password_hash)'
        );
        $insert->execute([
            'family_name' => $familyName,
            'given_name' => $givenName,
            'login_name' => $loginName,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);

        return $this->getUserById((int)$this->pdo->lastInsertId()) ?? [
            'id' => (int)$this->pdo->lastInsertId(),
            'family_name' => $familyName,
            'given_name' => $givenName,
            'login_name' => $loginName,
            'display_name' => trim($familyName . ' ' . $givenName),
        ];
    }

    public function getGalleryImages(): array
    {
        $statement = $this->pdo->query(
            'SELECT g.id, g.title, g.image_path, g.created_at,
                    u.family_name, u.given_name, u.login_name
             FROM gallery_images g
             LEFT JOIN users u ON u.id = g.uploaded_by_user_id
             ORDER BY g.created_at DESC, g.id DESC'
        );

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $uploader = $this->normalizeUser($row);
            $items[] = [
                'id' => (int)$row['id'],
                'title' => trim((string)$row['title']),
                'image_path' => trim((string)$row['image_path']),
                'created_at' => (string)$row['created_at'],
                'uploader_label' => $uploader === null ? 'Rendszer' : $uploader['display_name'] . ' (' . $uploader['login_name'] . ')',
            ];
        }

        return $items;
    }

    public function createGalleryImage(string $title, string $imagePath, ?int $uploadedByUserId): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO gallery_images (title, image_path, uploaded_by_user_id)
             VALUES (:title, :image_path, :uploaded_by_user_id)'
        );
        $statement->execute([
            'title' => $title,
            'image_path' => $imagePath,
            'uploaded_by_user_id' => $uploadedByUserId,
        ]);
    }

    public function createContactMessage(
        ?int $userId,
        string $contactName,
        string $email,
        string $subject,
        string $message
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO contact_messages (user_id, contact_name, email, subject, message_body)
             VALUES (:user_id, :contact_name, :email, :subject, :message_body)'
        );
        $statement->execute([
            'user_id' => $userId,
            'contact_name' => $contactName,
            'email' => $email,
            'subject' => $subject,
            'message_body' => $message,
        ]);
    }

    public function getMessages(): array
    {
        $statement = $this->pdo->query(
            'SELECT m.id, m.contact_name, m.email, m.subject, m.message_body, m.created_at,
                    u.family_name, u.given_name, u.login_name
             FROM contact_messages m
             LEFT JOIN users u ON u.id = m.user_id
             ORDER BY m.created_at DESC, m.id DESC'
        );

        $items = [];

        foreach ($statement->fetchAll() as $row) {
            $user = $this->normalizeUser($row);
            $items[] = [
                'id' => (int)$row['id'],
                'subject' => trim((string)$row['subject']),
                'contact_name' => trim((string)$row['contact_name']),
                'email' => trim((string)$row['email']),
                'message_body' => trim((string)$row['message_body']),
                'created_at' => (string)$row['created_at'],
                'sender_label' => $user === null ? 'Vendég' : $user['display_name'] . ' (' . $user['login_name'] . ')',
            ];
        }

        return $items;
    }

    public function getPortalSummary(): array
    {
        return [
            'users' => $this->countRows('users'),
            'gallery_images' => $this->countRows('gallery_images'),
            'contact_messages' => $this->countRows('contact_messages'),
        ];
    }

    private function ensureSchema(): void
    {
        $statements = [
            'CREATE TABLE IF NOT EXISTS users (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                family_name VARCHAR(120) NOT NULL,
                given_name VARCHAR(120) NOT NULL,
                login_name VARCHAR(120) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci',
            'CREATE TABLE IF NOT EXISTS contact_messages (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NULL,
                contact_name VARCHAR(160) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                message_body TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_contact_messages_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci',
            'CREATE TABLE IF NOT EXISTS gallery_images (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                uploaded_by_user_id INT UNSIGNED NULL,
                title VARCHAR(255) NOT NULL,
                image_path VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_gallery_images_user
                    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
                    ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci',
        ];

        foreach ($statements as $statement) {
            $this->pdo->exec($statement);
        }
    }

    private function seedDefaultUser(): void
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM users WHERE login_name = :login_name');
        $statement->execute(['login_name' => 'Gamf1234']);

        if ((int)$statement->fetchColumn() > 0) {
            return;
        }

        $insert = $this->pdo->prepare(
            'INSERT INTO users (family_name, given_name, login_name, password_hash)
             VALUES (:family_name, :given_name, :login_name, :password_hash)'
        );
        $insert->execute([
            'family_name' => 'Gamf',
            'given_name' => '1234',
            'login_name' => 'Gamf1234',
            'password_hash' => password_hash('1234Gamf', PASSWORD_DEFAULT),
        ]);
    }

    private function seedGalleryIfEmpty(): void
    {
        $statement = $this->pdo->query('SELECT COUNT(*) FROM gallery_images');
        if ((int)$statement->fetchColumn() > 0) {
            return;
        }

        $seedItems = [
            ['Irodai szoftverek', 'assets/gallery/office-suite.svg'],
            ['Böngésző készlet', 'assets/gallery/browser-stack.svg'],
            ['Együttműködési csomag', 'assets/gallery/collaboration-cloud.svg'],
        ];

        $insert = $this->pdo->prepare(
            'INSERT INTO gallery_images (title, image_path, uploaded_by_user_id)
             VALUES (:title, :image_path, NULL)'
        );

        foreach ($seedItems as [$title, $imagePath]) {
            $insert->execute([
                'title' => $title,
                'image_path' => $imagePath,
            ]);
        }
    }

    private function countRows(string $table): int
    {
        return (int)$this->pdo->query(sprintf('SELECT COUNT(*) FROM %s', $table))->fetchColumn();
    }

    /**
     * @return array<string, string>
     */
    private function readConfig(): array
    {
        if (!is_file($this->envPath)) {
            throw new RuntimeException('A backend/.env fájl hiányzik, ezért az oldal adatbázisai nem konfigurálhatók.');
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

    private function normalizeUser(array $row): ?array
    {
        $id = isset($row['id']) ? (int)$row['id'] : null;
        $familyName = trim((string)($row['family_name'] ?? ''));
        $givenName = trim((string)($row['given_name'] ?? ''));
        $loginName = trim((string)($row['login_name'] ?? ''));

        if ($familyName === '' || $givenName === '' || $loginName === '') {
            return null;
        }

        return [
            'id' => $id ?? 0,
            'family_name' => $familyName,
            'given_name' => $givenName,
            'login_name' => $loginName,
            'display_name' => trim($familyName . ' ' . $givenName),
        ];
    }
}
