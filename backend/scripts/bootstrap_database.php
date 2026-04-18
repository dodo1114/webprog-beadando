<?php

declare(strict_types=1);

use App\SoftwareRepository;

require_once dirname(__DIR__) . '/src/SoftwareRepository.php';

$repository = new SoftwareRepository(
    dirname(__DIR__) . '/.env',
    dirname(__DIR__) . '/public/data/software.json',
);

$items = $repository->getAll();

fwrite(
    STDOUT,
    sprintf(
        "Database bootstrap OK. %d rekord érhető el a '%s' táblában.\n",
        count($items),
        $repository->getConnectionInfo()['table']
    )
);
