<?php

declare(strict_types=1);

use App\SiteRepository;
use App\SoftwareRepository;

require_once dirname(__DIR__) . '/src/SoftwareRepository.php';
require_once dirname(__DIR__) . '/src/SiteRepository.php';

$softwareRepository = new SoftwareRepository(
    dirname(__DIR__) . '/.env',
    dirname(__DIR__) . '/public/data/software.json',
);
$siteRepository = new SiteRepository(dirname(__DIR__) . '/.env');

$items = $softwareRepository->getAll();
$portalSummary = $siteRepository->getPortalSummary();

fwrite(
    STDOUT,
    sprintf(
        "Database bootstrap OK. %d rekord érhető el a '%s' táblában. Felhasználók: %d, képek: %d, üzenetek: %d. Belső ellenőrző fiók: konfigurálva.\n",
        count($items),
        $softwareRepository->getConnectionInfo()['table'],
        $portalSummary['users'],
        $portalSummary['gallery_images'],
        $portalSummary['contact_messages']
    )
);
