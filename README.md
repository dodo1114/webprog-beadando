# Szoftverleltár – Web-programozás 1 előadás házi feladat

A projekt a szoftverleltár adatain keresztül mutatja be a kliensoldali JavaScript, React, SPA, Fetch API, Axios, PHP/PDO és objektumorientált JavaScript használatát.

## Készítők

- Hársfalvi-Kuczmogh Miklós (D19FB3)
- Krakovszki Zalán Lóránt (D3FKB4)

## Modulok

- `index.html` – főoldal és közös navigáció
- `javascript.html` – kliensoldali JavaScript CRUD
- `react.html` – React állapotkezelésre épülő CRUD
- `spa.html` – SPA lapváltás, számológép és amőba
- `fetchapi.html` – natív Fetch API kliens
- `axios.html` – React + Axios kliens
- `oojs.html` – ES6 osztályokra és öröklésre épülő grafikus alkalmazás
- `api.php` – JSON-alapú PHP/PDO CRUD végpont
- `style.css` – közös megjelenés

## Követelmények

- PHP 8 vagy újabb, PDO MySQL bővítménnyel
- MySQL/MariaDB adatbázis a `gep`, `szoftver` és `telepites` táblákkal
- internetkapcsolat a React, ReactDOM és Axios CDN-fájlok betöltéséhez

## Adatbázis-konfiguráció

A repository nem tartalmaz valódi adatbázis-jelszót.

1. Másold le a mintát:

   ```powershell
   Copy-Item config.example.php config.local.php
   ```

2. Állítsd be a helyi adatbázis-kapcsolat értékeit a `config.local.php` fájlban.
3. A `config.local.php` a `.gitignore` része, ezért nem kerülhet Git-commitba.

A konfiguráció szerkezete:

```php
<?php
return [
    "host" => "localhost",
    "db_name" => "web_bead",
    "username" => "web_bead",
    "password" => "sajat-jelszo",
];
```

## Helyi futtatás

A projekt gyökerében:

```powershell
php -S localhost:8000
```

Ezután nyisd meg a `http://localhost:8000/index.html` címet.

## API

Az `api.php` JSON kéréseket fogad:

- `GET` – telepítések listázása
- `POST` – új telepítés rögzítése
- `PUT` – meglévő telepítés módosítása
- `DELETE` – telepítés törlése

A Fetch és Axios oldalak ugyanezt a végpontot használják.

## Biztonság

- Valódi hozzáférési adatot ne commitolj.
- A korábban használt adatbázis-jelszót cseréld le, ha éles rendszerhez tartozott.
- Feltöltés előtt ellenőrizd, hogy a `config.local.php` nem szerepel a követett fájlok között.
