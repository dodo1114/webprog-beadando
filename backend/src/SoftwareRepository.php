<?php

declare(strict_types=1);

namespace App;

use RuntimeException;

final class SoftwareRepository
{
    public function __construct(
        private readonly string $storagePath,
        private readonly string $seedPath,
    ) {
    }

    /**
     * @return array<int, array{id:int, nev:string, kategoria:string}>
     */
    public function getAll(): array
    {
        $this->ensureStorageExists();

        $handle = fopen($this->storagePath, 'c+');
        if ($handle === false) {
            throw new RuntimeException('A tárolófájl nem nyitható meg olvasásra.');
        }

        try {
            if (!flock($handle, LOCK_SH)) {
                throw new RuntimeException('A tárolófájl nem zárolható olvasásra.');
            }

            rewind($handle);
            $contents = stream_get_contents($handle);

            return $this->decodeItems($contents === false ? '' : $contents);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    public function find(int $id): ?array
    {
        foreach ($this->getAll() as $item) {
            if ($item['id'] === $id) {
                return $item;
            }
        }

        return null;
    }

    public function create(string $name, string $category): array
    {
        return $this->mutate(function (array $items) use ($name, $category): array {
            $nextId = 1;
            foreach ($items as $item) {
                $nextId = max($nextId, $item['id'] + 1);
            }

            $created = [
                'id' => $nextId,
                'nev' => $name,
                'kategoria' => $category,
            ];

            array_unshift($items, $created);

            return [$created, $items];
        });
    }

    public function update(int $id, string $name, string $category): ?array
    {
        return $this->mutate(function (array $items) use ($id, $name, $category): array {
            $updated = null;

            foreach ($items as $index => $item) {
                if ($item['id'] !== $id) {
                    continue;
                }

                $updated = [
                    'id' => $id,
                    'nev' => $name,
                    'kategoria' => $category,
                ];
                $items[$index] = $updated;
                break;
            }

            return [$updated, $items];
        });
    }

    public function delete(int $id): ?array
    {
        return $this->mutate(function (array $items) use ($id): array {
            $deleted = null;
            $remaining = [];

            foreach ($items as $item) {
                if ($item['id'] === $id) {
                    $deleted = $item;
                    continue;
                }

                $remaining[] = $item;
            }

            return [$deleted, $remaining];
        });
    }

    private function ensureStorageExists(): void
    {
        if (is_file($this->storagePath)) {
            return;
        }

        $directory = dirname($this->storagePath);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('A tárolómappa nem hozható létre.');
        }

        $seedItems = $this->loadSeedItems();
        $encoded = $this->encodeItems($seedItems);

        if (file_put_contents($this->storagePath, $encoded, LOCK_EX) === false) {
            throw new RuntimeException('A kezdeti tárolófájl nem hozható létre.');
        }
    }

    private function mutate(callable $callback): mixed
    {
        $this->ensureStorageExists();

        $handle = fopen($this->storagePath, 'c+');
        if ($handle === false) {
            throw new RuntimeException('A tárolófájl nem nyitható meg módosításra.');
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                throw new RuntimeException('A tárolófájl nem zárolható módosításra.');
            }

            rewind($handle);
            $contents = stream_get_contents($handle);
            $items = $this->decodeItems($contents === false ? '' : $contents);

            [$result, $nextItems] = $callback($items);

            rewind($handle);
            if (!ftruncate($handle, 0)) {
                throw new RuntimeException('A tárolófájl nem írható felül.');
            }

            $encoded = $this->encodeItems($nextItems);
            if (fwrite($handle, $encoded) === false) {
                throw new RuntimeException('A tárolófájl frissítése sikertelen.');
            }

            fflush($handle);

            return $result;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
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

        return $this->decodeItems($contents);
    }

    /**
     * @return array<int, array{id:int, nev:string, kategoria:string}>
     */
    private function decodeItems(string $contents): array
    {
        if (trim($contents) === '') {
            return [];
        }

        $decoded = json_decode($contents, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('A JSON adattároló sérült vagy nem értelmezhető.');
        }

        $items = [];

        foreach ($decoded as $item) {
            if (!is_array($item)) {
                continue;
            }

            $id = (int)($item['id'] ?? 0);
            $name = trim((string)($item['nev'] ?? ''));
            $category = trim((string)($item['kategoria'] ?? ''));

            if ($id <= 0 || $name === '' || $category === '') {
                continue;
            }

            $items[] = [
                'id' => $id,
                'nev' => $name,
                'kategoria' => $category,
            ];
        }

        usort(
            $items,
            static fn(array $left, array $right): int => $left['id'] <=> $right['id']
        );

        return $items;
    }

    /**
     * @param array<int, array{id:int, nev:string, kategoria:string}> $items
     */
    private function encodeItems(array $items): string
    {
        return (string)json_encode(
            array_values($items),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        ) . PHP_EOL;
    }
}
