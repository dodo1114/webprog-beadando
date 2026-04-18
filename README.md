# Webprog Beadandó

Ez a repository a Webprogramozás 1 beadandó közös, kétfős megvalósításához készül.

## Aktuális állapot

A projekt jelenleg az alábbi működő blokkokat tartalmazza:

- kezdőoldal a kötelező menüpontokkal
- működő JavaScript CRUD oldal a szoftverleltár adatkörével
- működő React CRUD oldal ugyanarra az adatkészletre
- működő React-alapú SPA két miniappal és közös kliensoldali állapottal
- működő PHP CRUD API JSON-alapú szerveroldali tárolóval
- működő Fetch API oldal, amely a PHP backenddel kommunikál
- működő Axios CRUD oldal React komponensekkel és Axios klienssel
- deploy script a `krakovszki.hu/web1` környezethez

## Projektstruktúra

- `backend/public/index.html`
  kezdőoldal a beadandó navigációjával
- `backend/public/javascript.html`
  kliensoldali JavaScript CRUD
- `backend/public/react.html`
  React CRUD
- `backend/public/spa.html`
  két miniappos SPA közös állapottal
- `backend/public/fetchapi.html`
  Fetch API + PHP CRUD kapcsolat
- `backend/public/axios.html`
  React + Axios kliens ugyanarra a PHP CRUD backendre
- `backend/public/index.php`
  API belépési pont
- `backend/src/SoftwareRepository.php`
  fájlalapú szerveroldali adattároló
- `docs/assignment-checklist.md`
  feladatblokk lista
- `docs/github-teamwork.md`
  kétfős GitHub workflow

## Következő lépések

1. OOJS rész elkészítése
2. dokumentáció, screenshotok és végső ellenőrzés
