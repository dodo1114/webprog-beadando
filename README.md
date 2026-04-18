# Webprog Beadandó

Ez a repository a Webprogramozás 1 beadandó közös, kétfős megvalósításához készül.

## Aktuális állapot

A projekt jelenleg az alábbi működő blokkokat tartalmazza:

- kezdőoldal a kötelező menüpontokkal
- működő JavaScript CRUD oldal a szoftverleltár adatkörével
- működő React CRUD oldal ugyanarra az adatkészletre
- működő React-alapú SPA két miniappal és közös kliensoldali állapottal
- működő PHP CRUD API MySQL adatbázis-alapú szerveroldali mentéssel
- működő Fetch API oldal, amely a PHP backenddel kommunikál
- működő Axios CRUD oldal React komponensekkel és Axios klienssel
- működő OOJS műhely class alapú DOM-építéssel és telepítési profil szerkesztővel
- helyi, repo-ba mentett React/Axios runtime a CDN-es betöltés kiváltására
- külön `react/src` és `react/dist` mappák a React-alapú feladatrészek forrás- és disztribúciós lenyomatával
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
- `backend/public/oojs.html`
  objektumorientált JavaScript műhely class alapú DOM-építéssel
- `backend/public/vendor`
  helyben tárolt React, ReactDOM, Axios és htm runtime fájlok
- `backend/public/index.php`
  API belépési pont
- `backend/src/SoftwareRepository.php`
  PDO-alapú MySQL adattároló
- `react/src`
  a React-alapú oldalak forrásoldali JavaScript lenyomatai
- `react/dist`
  a publikált React oldalak disztribúciós belépőfájljai
- `docs/assignment-checklist.md`
  feladatblokk lista
- `docs/github-teamwork.md`
  kétfős GitHub workflow

## Következő lépések

1. dokumentáció, screenshotok és végső ellenőrzés
