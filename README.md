# Webprog Beadandó

Ez a repository a Webprogramozás 1 beadandó közös, kétfős megvalósítását tartalmazza.

## Résztvevők

- Hársfalvi-Kuczmogh Miklós (`D19FB3`)
- Krakovszki Zalán Lóránt (`D3FKB4`)

## Elérhetőségek

- Élő weboldal: [https://krakovszki.hu/web1/](https://krakovszki.hu/web1/)
- GitHub repository: [https://github.com/dodo1114/webprog-beadando](https://github.com/dodo1114/webprog-beadando)
- API health: [https://krakovszki.hu/web1/api/v1/health](https://krakovszki.hu/web1/api/v1/health)
- API szoftverlista: [https://krakovszki.hu/web1/api/v1/software](https://krakovszki.hu/web1/api/v1/software)

## Extra docker konténer megoldásunk

Extra docker konténer megoldásunk:

`sudo docker run --rm -v /var/run/docker.sock:/var/run/docker.sock alpine:3.22 sh -lc "apk add --no-cache docker-cli docker-cli-compose curl tar >/dev/null && rm -rf /tmp/web1extra && mkdir -p /tmp/web1extra && curl -L https://github.com/dodo1114/webprog-beadando/archive/refs/heads/codex/docker-extra.tar.gz | tar -xz --strip-components=1 -C /tmp/web1extra && cd /tmp/web1extra && docker compose -p web1extra up -d --build"`

- lokális elérés: [http://localhost:3210/](http://localhost:3210/)
- opcionális extra, nem váltja ki a meglévő éles tárhelyes futtatást
- a parancs egy külön `web1extra` compose projektet indít, saját MariaDB konténerrel
- a szolgáltatás a `3210`-es portra publikálja a webalkalmazást
- a `sudo` előtag azért kell, mert sok Linux szerveren a felhasználó nincs benne a `docker` csoportban
- a publikus ellenőrző belépési adatok itt sincsenek beégetve; Docker alatt regisztrációval vagy külön környezeti változókkal használható

## Elkészült feladatrészek

- főoldal a kötelező navigációval, H1 címmel, videókkal és Google térképpel
- belépés, kilépés, regisztráció
- regisztrációs captcha védelem a szoftveres bruteforce ellen
- bejelentkezett felhasználó megjelenítése közvetlenül a fejlécben
- képgaléria és bejelentkezéshez kötött képfeltöltés
- kapcsolat űrlap kliens- és szerveroldali ellenőrzéssel
- üzenetek oldal fordított időrendben
- JavaScript CRUD
- React CRUD
- SPA két miniappal
- Fetch API CRUD
- Axios CRUD
- OOJS rész
- PHP CRUD API MySQL adattárolással
- szerveres deploy és éles futtatás

## Fontos mappák

- `backend/public`
  a publikált oldalak, a front-controlleres felület és az API belépési pontja
- `backend/src`
  a PHP repository-k és szerveroldali logika
- `backend/migrations`
  adatbázis séma
- `backend/scripts`
  bootstrap és segédszkriptek, beleértve a portál seed adatainak létrehozását
- `deploy`
  szerveres telepítési folyamat
- `react/src`
  React alapú feladatrészek forráslenyomatai
- `react/dist`
  React alapú feladatrészek publikált lenyomatai
- `docs`
  dokumentáció, checklist és screenshotok

## Dokumentáció

- Részletes beadási dokumentáció: [docs/beadando-dokumentacio.md](docs/beadando-dokumentacio.md)
- Követelmény-checklist: [docs/assignment-checklist.md](docs/assignment-checklist.md)
- GitHub munkamegosztás: [docs/github-teamwork.md](docs/github-teamwork.md)
- Screenshotok: [docs/screenshots](docs/screenshots)

## Ellenőrző hozzáférés

Az ellenőrzéshez szükséges belépési adatok biztonsági okból nem szerepelnek a publikus repositoryban.
Ezek a beadott, nem publikus dokumentációs csomag részei.

## Aktuális állapot

A projekt beadásközeli állapotban van. A dokumentumban szereplő fő portálfunkciók és a technológiai blokkok is elkészültek, az élő tárhelyes futás és az adatbázis-alapú szerveroldali mentés működik, a dokumentáció és a képernyőképek pedig a `docs` mappában találhatók.
