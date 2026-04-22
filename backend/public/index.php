<?php

declare(strict_types=1);

use App\SiteRepository;
use App\SoftwareRepository;

require_once dirname(__DIR__) . '/src/SoftwareRepository.php';
require_once dirname(__DIR__) . '/src/SiteRepository.php';

session_start();

$rawPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$mountPath = '';
$path = $rawPath;

if (str_starts_with($rawPath, '/web1/')) {
    $mountPath = '/web1';
    $path = substr($rawPath, strlen($mountPath));
} elseif ($rawPath === '/web1') {
    $mountPath = '/web1';
    $path = '/';
}

if (str_starts_with($path, '/api/v1/')) {
    handleApiRequest($path, $method);
}

if ($path === '/') {
    redirectTo('/home');
}

$route = trim($path, '/');
try {
    $currentUser = currentUser();

    switch ($route) {
        case 'home':
            renderHtmlPage(
                'Webprogramozás 1 előadás házi feladat',
                'home',
                renderHomeContent(),
                $currentUser
            );
            break;

        case 'belepes':
            if ($method === 'POST') {
                handleAuthSubmit();
            }

            renderHtmlPage(
                'Belépés és regisztráció',
                'belepes',
                renderAuthContent(),
                $currentUser
            );
            break;

        case 'kilepes':
            $_SESSION = [];
            session_regenerate_id(true);
            flash('success', 'Sikeresen kijelentkeztél.');
            redirectTo('/home');
            break;

        case 'kepek':
            if ($method === 'POST') {
                requireLogin();
                handleGalleryUpload();
            }

            renderHtmlPage(
                'Képek és galéria',
                'kepek',
                renderGalleryContent(siteRepository()->getGalleryImages(), $currentUser),
                $currentUser,
                ['scripts' => [url('/assets/js/gallery-lightbox.js')]]
            );
            break;

        case 'kapcsolat':
            if ($method === 'POST') {
                handleContactSubmit();
            }

            renderHtmlPage(
                'Kapcsolat',
                'kapcsolat',
                renderContactContent($currentUser),
                $currentUser,
                ['scripts' => [url('/assets/js/contact-form.js')]]
            );
            break;

        case 'uzenetek':
            requireLogin();
            renderHtmlPage(
                'Üzenetek',
                'uzenetek',
                renderMessagesContent(siteRepository()->getMessages()),
                $currentUser
            );
            break;

        case 'crud':
            renderHtmlPage(
                'CRUD',
                'crud',
                renderCrudContent(),
                $currentUser
            );
            break;

        default:
            http_response_code(404);
            renderHtmlPage(
                'Az oldal nem található',
                '',
                renderNotFoundContent(),
                $currentUser
            );
            break;
    }
} catch (Throwable $exception) {
    http_response_code(500);
    renderHtmlPage(
        'Alkalmazáshiba',
        '',
        renderInfrastructureErrorContent($exception->getMessage()),
        null
    );
}

function handleApiRequest(string $path, string $method): never
{
    header('Content-Type: application/json; charset=utf-8');
    $canWriteSoftware = canModifySoftwareInventory();

    if ($path === '/api/v1/health' && $method === 'GET') {
        try {
            $connectionInfo = softwareRepository()->getConnectionInfo();
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
                'items' => softwareRepository()->getAll(),
                'can_write' => $canWriteSoftware,
                'write_user' => 'Gamf1234',
            ]);
        } catch (RuntimeException $exception) {
            respond(500, [
                'error' => 'storage_error',
                'message' => $exception->getMessage(),
            ]);
        }
    }

    if ($path === '/api/v1/software' && $method === 'POST') {
        requireSoftwareWriteAccessApi();
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
            $created = softwareRepository()->create($name, $category);
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
                $item = softwareRepository()->find($id);
                if ($item === null) {
                    respond(404, [
                        'error' => 'not_found',
                        'message' => 'A keresett szoftver nem található.',
                    ]);
                }

                respond(200, [
                    'item' => $item,
                    'can_write' => $canWriteSoftware,
                    'write_user' => 'Gamf1234',
                ]);
            }

            if ($method === 'PATCH') {
                requireSoftwareWriteAccessApi();
                $payload = readJsonPayload();
                $name = normalizeField($payload, 'nev');
                $category = normalizeField($payload, 'kategoria');

                if ($name === '' || $category === '') {
                    respond(422, [
                        'error' => 'validation_failed',
                        'message' => 'A név és a kategória megadása kötelező.',
                    ]);
                }

                $updated = softwareRepository()->update($id, $name, $category);
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
                requireSoftwareWriteAccessApi();
                $deleted = softwareRepository()->delete($id);
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

    respond(405, [
        'error' => 'method_or_route_not_supported',
        'message' => 'Ez az API útvonal vagy HTTP metódus nincs támogatva.',
        'path' => $path,
        'method' => $method,
    ]);
}

function handleAuthSubmit(): never
{
    $action = trim((string)($_POST['auth_action'] ?? 'login'));

    if ($action === 'register') {
        $familyName = trim((string)($_POST['family_name'] ?? ''));
        $givenName = trim((string)($_POST['given_name'] ?? ''));
        $loginName = trim((string)($_POST['login_name'] ?? ''));
        $password = (string)($_POST['password'] ?? '');
        $passwordAgain = (string)($_POST['password_again'] ?? '');
        $captchaAnswer = trim((string)($_POST['captcha_answer'] ?? ''));

        if ($familyName === '' || $givenName === '' || $loginName === '' || $password === '') {
            refreshRegistrationCaptcha();
            flash('error', 'Regisztrációhoz minden mező kitöltése kötelező.');
            redirectTo('/belepes');
        }

        if ($password !== $passwordAgain) {
            refreshRegistrationCaptcha();
            flash('error', 'A két jelszó nem egyezik meg.');
            redirectTo('/belepes');
        }

        if (strlen($password) < 6) {
            refreshRegistrationCaptcha();
            flash('error', 'A jelszónak legalább 6 karakter hosszúnak kell lennie.');
            redirectTo('/belepes');
        }

        if (!isRegistrationCaptchaValid($captchaAnswer)) {
            refreshRegistrationCaptcha();
            flash('error', 'A captcha ellenőrzés sikertelen volt. Oldd meg az új feladatot, és próbáld meg ismét.');
            redirectTo('/belepes');
        }

        try {
            siteRepository()->registerUser($familyName, $givenName, $loginName, $password);
            refreshRegistrationCaptcha();
            flash('success', 'A regisztráció sikeres volt. A rendszer nem léptet be automatikusan, most jelentkezz be.');
        } catch (RuntimeException $exception) {
            refreshRegistrationCaptcha();
            flash('error', $exception->getMessage());
        }

        redirectTo('/belepes');
    }

    $loginName = trim((string)($_POST['login_name'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if ($loginName === '' || $password === '') {
        flash('error', 'Belépéshez add meg a login nevet és a jelszót is.');
        redirectTo('/belepes');
    }

    $user = siteRepository()->authenticate($loginName, $password);
    if ($user === null) {
        flash('error', 'A megadott felhasználónév vagy jelszó hibás.');
        redirectTo('/belepes');
    }

    $_SESSION['user_id'] = $user['id'];
    session_regenerate_id(true);

    flash('success', 'Sikeres belépés: ' . $user['display_name'] . ' (' . $user['login_name'] . ')');
    redirectTo('/home');
}

function handleGalleryUpload(): never
{
    $title = trim((string)($_POST['image_title'] ?? ''));
    $file = $_FILES['image_file'] ?? null;

    if ($title === '' || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        flash('error', 'Képfeltöltéshez cím és érvényes képfájl szükséges.');
        redirectTo('/kepek');
    }

    $tmpPath = (string)($file['tmp_name'] ?? '');
    $mimeType = mime_content_type($tmpPath) ?: '';
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    if (!isset($allowed[$mimeType])) {
        flash('error', 'Csak JPG, PNG, WEBP vagy GIF kép tölthető fel.');
        redirectTo('/kepek');
    }

    $uploadsDirectory = __DIR__ . '/uploads';
    if (!is_dir($uploadsDirectory) && !mkdir($uploadsDirectory, 0775, true) && !is_dir($uploadsDirectory)) {
        flash('error', 'A képfeltöltési mappa nem hozható létre.');
        redirectTo('/kepek');
    }

    $targetFileName = 'gallery-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $allowed[$mimeType];
    $targetPath = $uploadsDirectory . '/' . $targetFileName;

    if (!move_uploaded_file($tmpPath, $targetPath)) {
        flash('error', 'A képfájl nem menthető a szerverre.');
        redirectTo('/kepek');
    }

    $user = currentUser();
    siteRepository()->createGalleryImage($title, 'uploads/' . $targetFileName, $user['id'] ?? null);

    flash('success', 'A kép sikeresen feltöltve: ' . $title . '.');
    redirectTo('/kepek');
}

function handleContactSubmit(): never
{
    $contactName = trim((string)($_POST['contact_name'] ?? ''));
    $email = trim((string)($_POST['email'] ?? ''));
    $subject = trim((string)($_POST['subject'] ?? ''));
    $message = trim((string)($_POST['message_body'] ?? ''));

    if ($contactName === '' || $email === '' || $subject === '' || $message === '') {
        flash('error', 'A kapcsolat űrlap minden mezőjét ki kell tölteni.');
        redirectTo('/kapcsolat');
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        flash('error', 'Az e-mail cím formátuma nem megfelelő.');
        redirectTo('/kapcsolat');
    }

    if (stringLength($subject) < 3 || stringLength($message) < 10) {
        flash('error', 'A tárgy legyen legalább 3, az üzenet legalább 10 karakter hosszú.');
        redirectTo('/kapcsolat');
    }

    $user = currentUser();

    siteRepository()->createContactMessage(
        $user['id'] ?? null,
        $contactName,
        $email,
        $subject,
        $message
    );

    if ($user === null) {
        flash('success', 'Az üzenet sikeresen el lett mentve az adatbázisba. A feladó a listában Vendég néven fog megjelenni.');
        redirectTo('/kapcsolat');
    }

    flash('success', 'Az üzenet sikeresen el lett mentve az adatbázisba. Az Üzenetek oldalon már vissza is ellenőrizheted.');
    redirectTo('/uzenetek');
}

function renderHtmlPage(string $title, string $activeMenu, string $content, ?array $currentUser, array $options = []): never
{
    header('Content-Type: text/html; charset=utf-8');

    $flash = consumeFlash();
    $scripts = $options['scripts'] ?? [];

    echo '<!doctype html><html lang="hu"><head>';
    echo '<meta charset="UTF-8" />';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
    echo '<title>' . h($title) . '</title>';
    echo '<link rel="stylesheet" href="' . h(url('/assets/css/app.css')) . '" />';
    echo '</head><body>';
    echo '<header class="site-shell__header">';
    echo '<div class="page site-shell__header-inner">';
    echo '<div class="site-shell__brand-block">';
    echo '<p class="eyebrow site-shell__eyebrow">Web-programozás 1 gyakorlat beadandó</p>';
    echo '<strong class="site-shell__brand">Szoftverleltár portál</strong>';
    echo '</div>';
    echo '<div class="site-shell__header-tools">';
    echo renderHeaderIdentity($currentUser);
    echo renderNavigation($activeMenu, $currentUser);
    echo '</div>';
    echo '</div></header>';
    echo '<main class="page site-shell__main">';
    if ($flash !== null) {
        echo '<section class="panel flash flash--' . h($flash['type']) . '"><p>' . h($flash['message']) . '</p></section>';
    }
    echo $content;
    echo '</main>';
    echo '<footer class="site-footer"><div class="site-footer__inner">';
    echo '<p>Hársfalvi-Kuczmogh Miklós (D19FB3)</p>';
    echo '<p>Krakovszki Zalán Lóránt (D3FKB4)</p>';
    echo '</div></footer>';
    foreach ($scripts as $script) {
        echo '<script src="' . h($script) . '"></script>';
    }
    echo '</body></html>';
    exit;
}

function renderNavigation(string $activeMenu, ?array $currentUser): string
{
    $items = [
        ['key' => 'home', 'label' => 'Főoldal', 'href' => url('/home')],
        ['key' => 'kepek', 'label' => 'Képek', 'href' => url('/kepek')],
        ['key' => 'kapcsolat', 'label' => 'Kapcsolat', 'href' => url('/kapcsolat')],
    ];

    if ($currentUser !== null) {
        $items[] = ['key' => 'uzenetek', 'label' => 'Üzenetek', 'href' => url('/uzenetek')];
    }

    $items[] = ['key' => 'crud', 'label' => 'CRUD', 'href' => url('/crud')];
    $items[] = $currentUser === null
        ? ['key' => 'belepes', 'label' => 'Bejelentkezés / Regisztráció', 'href' => url('/belepes')]
        : ['key' => 'kilepes', 'label' => 'Kilépés', 'href' => url('/kilepes')];

    $html = '<nav class="site-nav" aria-label="Fő navigáció"><ul class="site-nav__list">';

    foreach ($items as $item) {
        $activeClass = $item['key'] === $activeMenu ? ' is-active' : '';
        $html .= '<li><a class="site-nav__link' . $activeClass . '" href="' . h($item['href']) . '">' . h($item['label']) . '</a></li>';
    }

    $html .= '</ul></nav>';

    return $html;
}

function renderHeaderIdentity(?array $currentUser): string
{
    if ($currentUser === null) {
        return '<div class="header-user-card"><span class="header-user-card__label">Bejelentkezett:</span><strong class="header-user-card__value">Vendég</strong></div>';
    }

    $label = $currentUser['display_name'] . ' (' . $currentUser['login_name'] . ')';
    return '<div class="header-user-card"><span class="header-user-card__label">Bejelentkezett:</span><strong class="header-user-card__value">' . h($label) . '</strong></div>';
}

function renderHomeContent(): string
{
    return '
      <section class="hero">
        <p class="eyebrow">Szoftverleltár projekt</p>
        <h1 class="assignment-title">Web-programozás 1 gyakorlat beadandó feladat</h1>
        <p class="lead">
          Ez a többoldalas felület a beadandó dokumentum szerkezetéhez igazodik. A fő fókusz a szoftverleltár,
          a hozzá tartozó CRUD, a kapcsolatfelvétel, a képgaléria és a bejelentkezéses működés bemutatása.
        </p>
      </section>

      <section class="panel extra-note-panel">
        <p class="eyebrow">Extra</p>
        <h2>Docker indítás</h2>
        <p class="lead">
          Extra docker konténer megoldásunk:
          <code>sudo docker run --rm -v /var/run/docker.sock:/var/run/docker.sock alpine:3.22 sh -lc "apk add --no-cache docker-cli docker-cli-compose curl tar &gt;/dev/null &amp;&amp; rm -rf /tmp/web1extra &amp;&amp; mkdir -p /tmp/web1extra &amp;&amp; curl -L https://github.com/dodo1114/webprog-beadando/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 -C /tmp/web1extra &amp;&amp; cd /tmp/web1extra &amp;&amp; docker compose -p web1extra down -v --remove-orphans &gt;/dev/null 2&gt;&amp;1 || true &amp;&amp; docker compose -p web1extra up -d --build"</code>.
        </p>
        <p class="muted-line">
          A Docker extra egy külön <strong>web1extra</strong> compose projektet indít saját adatbázissal,
          és a webalkalmazást a <strong>3210</strong>-es portra publikálja. A <code>sudo</code> előtag azért szerepel,
          mert sok Linux szerveren a normál felhasználó nem fér hozzá közvetlenül a Docker daemonhoz.
          Az indítás előtt a parancs a korábbi <code>web1extra</code> konténereket és volume-okat is letakarítja,
          így félresikerült korábbi próbák után is tiszta állapotból indul.
        </p>
      </section>

      <section class="section media-grid">
        <article class="panel media-card">
          <p class="eyebrow">Saját tárhelyről</p>
          <h2>Rövid helyi videó</h2>
          <video class="embedded-media" controls preload="metadata">
            <source src="' . h(url('/assets/media/software-demo.mp4')) . '" type="video/mp4" />
          </video>
        </article>
        <article class="panel media-card">
          <p class="eyebrow">Szolgáltatótól</p>
          <h2>YouTube beágyazás</h2>
          <iframe
            class="embedded-media embedded-media--frame"
            src="https://www.youtube.com/embed/M7lc1UVf-VE"
            title="YouTube videó"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </article>
      </section>

      <section class="panel map-card">
        <p class="eyebrow">Fizikai cím</p>
        <h2>Google térkép</h2>
        <p class="lead">A beágyazott térkép a GAMF Kecskemét környezetét mutatja.</p>
        <iframe
          class="embedded-media embedded-media--map"
          src="https://www.google.com/maps?q=GAMF%20Kecskem%C3%A9t&output=embed"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          title="Google térkép"
        ></iframe>
      </section>
    ';
}

function renderAuthContent(): string
{
    $captcha = getRegistrationCaptcha();

    return '
      <section class="hero">
        <p class="eyebrow">Belépés / Regisztráció</p>
        <h1>Felhasználói hozzáférés</h1>
        <p class="lead">
          A beadandó dokumentum szerint a rendszer tartalmaz belépést, kilépést és regisztrációt.
          A publikus felületen érzékeny belépési adat nem jelenik meg.
        </p>
      </section>

      <section class="auth-grid">
        <section class="panel">
          <p class="eyebrow">Belépés</p>
          <h2>Meglévő fiók</h2>
          <form class="stack-form" method="post" action="' . h(url('/belepes')) . '">
            <input type="hidden" name="auth_action" value="login" />
            <div class="field-group">
              <label class="field-label" for="loginName">Login név</label>
              <input id="loginName" class="text-input" type="text" name="login_name" />
            </div>
            <div class="field-group">
              <label class="field-label" for="loginPassword">Jelszó</label>
              <input id="loginPassword" class="text-input" type="password" name="password" />
            </div>
            <div class="form-actions">
              <button class="button primary" type="submit">Belépés</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <p class="eyebrow">Regisztráció</p>
          <h2>Új felhasználó létrehozása</h2>
          <p class="muted-line">
            A regisztrációt szerveroldalon ellenőrzött captcha védi, hogy automatikus szoftveres próbálkozásokkal ne lehessen túlterhelni az űrlapot.
          </p>
          <form class="stack-form" method="post" action="' . h(url('/belepes')) . '">
            <input type="hidden" name="auth_action" value="register" />
            <div class="field-group">
              <label class="field-label" for="familyName">Családi név</label>
              <input id="familyName" class="text-input" type="text" name="family_name" />
            </div>
            <div class="field-group">
              <label class="field-label" for="givenName">Utónév</label>
              <input id="givenName" class="text-input" type="text" name="given_name" />
            </div>
            <div class="field-group">
              <label class="field-label" for="registerLogin">Login név</label>
              <input id="registerLogin" class="text-input" type="text" name="login_name" />
            </div>
            <div class="field-group">
              <label class="field-label" for="registerPassword">Jelszó</label>
              <input id="registerPassword" class="text-input" type="password" name="password" />
            </div>
            <div class="field-group">
              <label class="field-label" for="registerPasswordAgain">Jelszó újra</label>
              <input id="registerPasswordAgain" class="text-input" type="password" name="password_again" />
            </div>
            <div class="field-group">
              <label class="field-label" for="registerCaptcha">Captcha ellenőrzés</label>
              <div class="captcha-box">
                <p class="captcha-box__question">' . h($captcha['question']) . '</p>
                <p class="captcha-box__hint">Írd be számmal a helyes eredményt.</p>
              </div>
              <input
                id="registerCaptcha"
                class="text-input"
                type="text"
                name="captcha_answer"
                inputmode="numeric"
                autocomplete="off"
                placeholder="Például: 12"
              />
            </div>
            <div class="form-actions">
              <button class="button primary" type="submit">Regisztráció</button>
            </div>
          </form>
        </section>
      </section>
    ';
}

function renderGalleryContent(array $images, ?array $currentUser): string
{
    $uploadForm = '';

    if ($currentUser !== null) {
        $uploadForm = '
          <section class="panel">
            <p class="eyebrow">Képfeltöltés</p>
            <h2>Új kép feltöltése</h2>
            <form class="stack-form" method="post" enctype="multipart/form-data" action="' . h(url('/kepek')) . '">
              <div class="field-group">
                <label class="field-label" for="imageTitle">Kép címe</label>
                <input id="imageTitle" class="text-input" type="text" name="image_title" />
              </div>
              <div class="field-group">
                <label class="field-label" for="imageFile">Képfájl</label>
                <input id="imageFile" class="text-input" type="file" name="image_file" accept=".jpg,.jpeg,.png,.webp,.gif" />
              </div>
              <div class="form-actions">
                <button class="button primary" type="submit">Feltöltés</button>
              </div>
            </form>
          </section>
        ';
    }

    $cards = '';
    foreach ($images as $image) {
        $imageUrl = url('/' . ltrim($image['image_path'], '/'));
        $caption = $image['title'];
        $meta = 'Feltöltő: ' . $image['uploader_label'] . ' | Dátum: ' . $image['created_at'];

        $cards .= '
          <article class="card gallery-card">
            <button
              class="gallery-card__trigger"
              type="button"
              data-gallery-image="true"
              data-image-src="' . h($imageUrl) . '"
              data-image-alt="' . h($image['title']) . '"
              data-image-caption="' . h($caption) . '"
              data-image-meta="' . h($meta) . '"
              aria-label="' . h($image['title']) . ' megnyitása nagy nézetben"
            >
              <img class="gallery-card__image" src="' . h($imageUrl) . '" alt="' . h($image['title']) . '" />
            </button>
            <h3>' . h($image['title']) . '</h3>
            <p>Feltöltő: ' . h($image['uploader_label']) . '</p>
            <p>Dátum: ' . h($image['created_at']) . '</p>
          </article>
        ';
    }

    if ($cards === '') {
        $cards = '<section class="panel"><div class="empty-state-box">Még nincs kép a galériában.</div></section>';
    }

    return '
      <section class="hero">
        <p class="eyebrow">Képek és galéria</p>
        <h1>Galéria</h1>
        <p class="lead">
          A képfeltöltés csak bejelentkezett felhasználónak érhető el, a galéria tartalma viszont bárki számára megtekinthető.
          A képekre kattintva nagy nézetben is megnyithatók.
        </p>
      </section>
      ' . $uploadForm . '
      <section class="section gallery-grid">' . $cards . '</section>
      <div class="gallery-lightbox" id="galleryLightbox" hidden>
        <div class="gallery-lightbox__backdrop" data-gallery-close="true"></div>
        <div class="gallery-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Kép nagy nézetben">
          <button class="gallery-lightbox__close" type="button" data-gallery-close="true" aria-label="Nagy nézet bezárása">X</button>
          <figure class="gallery-lightbox__figure">
            <img class="gallery-lightbox__image" id="galleryLightboxImage" src="" alt="" />
            <figcaption class="gallery-lightbox__caption">
              <strong class="gallery-lightbox__title" id="galleryLightboxCaption"></strong>
              <span class="gallery-lightbox__meta" id="galleryLightboxMeta"></span>
            </figcaption>
          </figure>
        </div>
      </div>
    ';
}

function renderContactContent(?array $currentUser): string
{
    $nameValue = $currentUser === null ? '' : $currentUser['display_name'];
    $emailHint = $currentUser === null ? '' : $currentUser['login_name'] . '@gamf.local';
    $helperText = $currentUser === null
        ? 'Bejelentkezés nélkül is küldhetsz üzenetet. Ilyenkor a bejegyzés a listában Vendég feladóval jelenik meg.'
        : 'Bejelentkezett felhasználóként mentés után az Üzenetek oldalon rögtön látni fogod az új bejegyzést.';

    return '
      <section class="hero">
        <p class="eyebrow">Kapcsolat</p>
        <h1>Üzenetküldés</h1>
        <p class="lead">
          Az űrlap kliens- és szerveroldalon is ellenőrzi az adatokat, majd az üzenetet elmenti az adatbázisba.
        </p>
      </section>

      <section class="panel">
        <p class="muted-line">' . h($helperText) . '</p>
        <div id="contactValidationBox" class="validation-box" hidden></div>
        <form id="contactForm" class="stack-form" method="post" action="' . h(url('/kapcsolat')) . '" novalidate>
          <div class="field-group">
            <label class="field-label" for="contactName">Név</label>
            <input id="contactName" class="text-input" type="text" name="contact_name" value="' . h($nameValue) . '" />
          </div>
          <div class="field-group">
            <label class="field-label" for="contactEmail">E-mail</label>
            <input id="contactEmail" class="text-input" type="email" name="email" value="' . h($emailHint) . '" />
          </div>
          <div class="field-group">
            <label class="field-label" for="contactSubject">Tárgy</label>
            <input id="contactSubject" class="text-input" type="text" name="subject" />
          </div>
          <div class="field-group">
            <label class="field-label" for="contactMessage">Üzenet</label>
            <textarea id="contactMessage" class="text-input contact-textarea" name="message_body"></textarea>
          </div>
          <div class="form-actions">
            <button class="button primary" type="submit">Üzenet küldése</button>
          </div>
        </form>
      </section>
    ';
}

function renderMessagesContent(array $messages): string
{
    $rows = '';

    foreach ($messages as $message) {
        $rows .= '
          <tr>
            <td>' . h($message['created_at']) . '</td>
            <td>' . h($message['sender_label']) . '</td>
            <td>' . h($message['subject']) . '</td>
            <td>' . h($message['contact_name']) . '<br /><span class="muted-inline">' . h($message['email']) . '</span></td>
            <td>' . nl2br(h($message['message_body'])) . '</td>
          </tr>
        ';
    }

    if ($rows === '') {
        $rows = '<tr><td colspan="5"><div class="empty-state-box">Még nincs elküldött üzenet.</div></td></tr>';
    }

    return '
      <section class="hero">
        <p class="eyebrow">Üzenetek</p>
        <h1>Beérkezett kapcsolatok</h1>
        <p class="lead">
          Az üzenetek fordított időrendben jelennek meg. Ha nem bejelentkezett felhasználó küldte, a feladó neve: Vendég.
        </p>
      </section>
      <section class="panel">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Küldés ideje</th>
                <th>Feladó</th>
                <th>Tárgy</th>
                <th>Kapcsolat</th>
                <th>Üzenet</th>
              </tr>
            </thead>
            <tbody>' . $rows . '</tbody>
          </table>
        </div>
      </section>
    ';
}

function renderCrudContent(): string
{
    return '
      <section class="hero">
        <p class="eyebrow">CRUD menü</p>
        <h1>Szoftverleltár karbantartás</h1>
        <p class="lead">
          A dokumentum szerinti CRUD rész a szoftverleltár táblára épül. Az alábbi beágyazott felületen a rekordok
          listázása, létrehozása, módosítása és törlése útvonalas szerveroldali API-val történik.
        </p>
      </section>
      <section class="panel">
        <div class="iframe-shell">
          <iframe class="crud-frame" src="' . h(url('/axios.html')) . '" title="CRUD alkalmazás"></iframe>
        </div>
      </section>
    ';
}

function renderNotFoundContent(): string
{
    return '
      <section class="hero">
        <p class="eyebrow">404</p>
        <h1>Az oldal nem található</h1>
        <p class="lead">A keresett útvonal nem létezik. A főoldalról újra elérhető az alkalmazás minden kötelező menüpontja.</p>
      </section>
    ';
}

function renderInfrastructureErrorContent(string $message): string
{
    return '
      <section class="hero">
        <p class="eyebrow">Konfigurációs hiba</p>
        <h1>Az alkalmazás most nem indítható</h1>
        <p class="lead">
          A portál elindult, de a háttérszolgáltatás nem érhető el. Ellenőrizd a <code>backend/.env</code> adatbázis-beállításait,
          majd a MySQL kapcsolatot.
        </p>
      </section>
      <section class="panel">
        <p><strong>Részlet:</strong> ' . h($message) . '</p>
      </section>
    ';
}

function currentUser(): ?array
{
    $userId = (int)($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) {
        return null;
    }

    return siteRepository()->getUserById($userId);
}

function requireLogin(): void
{
    if (currentUser() !== null) {
        return;
    }

    flash('error', 'Ehhez az oldalhoz bejelentkezés szükséges.');
    redirectTo('/belepes');
}

function canModifySoftwareInventory(): bool
{
    $user = currentUser();

    return $user !== null && (($user['login_name'] ?? '') === 'Gamf1234');
}

function requireSoftwareWriteAccessApi(): void
{
    if (canModifySoftwareInventory()) {
        return;
    }

    respond(403, [
        'error' => 'forbidden',
        'message' => 'Az adatbázis módosításához a Gamf1234 felhasználóval kell belépni.',
        'write_user' => 'Gamf1234',
    ]);
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = [
        'type' => $type,
        'message' => $message,
    ];
}

function consumeFlash(): ?array
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return is_array($flash) ? $flash : null;
}

function redirectTo(string $path): never
{
    header('Location: ' . url($path));
    exit;
}

function url(string $path): string
{
    global $mountPath;

    $normalized = '/' . ltrim($path, '/');
    if ($normalized === '/home' && $mountPath === '') {
        return '/home';
    }

    return ($mountPath === '' ? '' : $mountPath) . $normalized;
}

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

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

function stringLength(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value);
    }

    return strlen($value);
}

/**
 * @return array{question:string,answer:string,generated_at:int}
 */
function getRegistrationCaptcha(bool $refresh = false): array
{
    $captcha = $_SESSION['registration_captcha'] ?? null;

    if (
        $refresh
        || !is_array($captcha)
        || !isset($captcha['question'], $captcha['answer'], $captcha['generated_at'])
        || (time() - (int)$captcha['generated_at']) > 900
    ) {
        $captcha = buildRegistrationCaptcha();
        $_SESSION['registration_captcha'] = $captcha;
    }

    return [
        'question' => (string)$captcha['question'],
        'answer' => (string)$captcha['answer'],
        'generated_at' => (int)$captcha['generated_at'],
    ];
}

function refreshRegistrationCaptcha(): void
{
    getRegistrationCaptcha(true);
}

function isRegistrationCaptchaValid(string $answer): bool
{
    $captcha = getRegistrationCaptcha();
    $normalizedAnswer = trim($answer);

    if ($normalizedAnswer === '' || preg_match('/^-?\d+$/', $normalizedAnswer) !== 1) {
        return false;
    }

    return hash_equals($captcha['answer'], $normalizedAnswer);
}

/**
 * @return array{question:string,answer:string,generated_at:int}
 */
function buildRegistrationCaptcha(): array
{
    $left = random_int(2, 12);
    $right = random_int(1, 9);
    $operation = random_int(0, 1) === 0 ? 'plus' : 'minus';

    if ($operation === 'minus' && $right > $left) {
        [$left, $right] = [$right, $left];
    }

    if ($operation === 'plus') {
        $question = sprintf(
            'Mennyi %s meg %s?',
            numberToHungarianWord($left),
            numberToHungarianWord($right)
        );
        $answer = (string)($left + $right);
    } else {
        $question = sprintf(
            'Mennyi %s mínusz %s?',
            numberToHungarianWord($left),
            numberToHungarianWord($right)
        );
        $answer = (string)($left - $right);
    }

    return [
        'question' => $question,
        'answer' => $answer,
        'generated_at' => time(),
    ];
}

function numberToHungarianWord(int $value): string
{
    $dictionary = [
        0 => 'nulla',
        1 => 'egy',
        2 => 'kettő',
        3 => 'három',
        4 => 'négy',
        5 => 'öt',
        6 => 'hat',
        7 => 'hét',
        8 => 'nyolc',
        9 => 'kilenc',
        10 => 'tíz',
        11 => 'tizenegy',
        12 => 'tizenkettő',
        13 => 'tizenhárom',
        14 => 'tizennégy',
        15 => 'tizenöt',
        16 => 'tizenhat',
        17 => 'tizenhét',
        18 => 'tizennyolc',
        19 => 'tizenkilenc',
        20 => 'húsz',
        21 => 'huszonegy',
    ];

    return $dictionary[$value] ?? (string)$value;
}

function softwareRepository(): SoftwareRepository
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

function siteRepository(): SiteRepository
{
    static $repository = null;

    if ($repository instanceof SiteRepository) {
        return $repository;
    }

    $repository = new SiteRepository(dirname(__DIR__) . '/.env');
    return $repository;
}
