<?php
// CORS fejlécek beállítása, hogy a böngésző és a React aszinkron módon elérhesse az API-t
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Ha a böngésző előzetes OPTIONS kérést küld (Preflight), azonnal sikeres státusszal lépjen ki
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ==========================================
// ADATBÁZIS CSATLAKOZÁSI ADATOK
// ==========================================
$configPath = __DIR__ . "/config.local.php";
if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode(["error" => "Hi?nyz? adatb?zis-konfigur?ci?."]);
    exit;
}

$config = require $configPath;
$host = $config["host"] ?? "";
$db_name = $config["db_name"] ?? "";
$username = $config["username"] ?? "";
$password = $config["password"] ?? "";

if ($host === "" || $db_name === "" || $username === "" || $password === "") {
    http_response_code(500);
    echo json_encode(["error" => "Hi?nyos adatb?zis-konfigur?ci?."]);
    exit;
}

try {
    // Biztonságos PDO kapcsolat felépítése UTF-8 kódolással
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $exception) {
    echo json_encode(["error" => "Adatbázis csatlakozási hiba: " . $exception->getMessage()]);
    exit;
}

// Beérkező HTTP metódus (GET, POST, PUT, DELETE) meghatározása
$method = $_SERVER['REQUEST_METHOD'];

switch($method) {
    
    // ==========================================
    // READ (GET) - A három tábla összekötése és listázása
    // ==========================================
    case 'GET':
        try {
            // INNER JOIN lekérdezés, ami összefésüli a gep, szoftver és telepites táblákat
            $query = "SELECT 
                        t.gepid, t.szoftverid, t.verzio, t.datum,
                        g.hely, g.tipus, g.ipcim,
                        sz.nev AS szoftver_neve, sz.kategoria
                      FROM telepites t
                      INNER JOIN gep g ON t.gepid = g.id
                      INNER JOIN szoftver sz ON t.szoftverid = sz.id
                      ORDER BY t.datum DESC";
            
            $stmt = $conn->prepare($query);
            $stmt->execute();
            
            // Az eredményeket asszociatív tömbként olvassuk be és JSON-ként küldjük vissza
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch(PDOException $e) {
            echo json_encode(["error" => "SQL hiba a lekérdezés során: " . $e->getMessage()]);
        }
        break;

    // ==========================================
    // CREATE (POST) - Új telepítési bejegyzés hozzáadása
    // ==========================================
    case 'POST':
        // A kliens által küldött nyers JSON adatok beolvasása és dekódolása
        $data = json_decode(file_get_contents("php://input"));
        
        // Ellenőrizzük, hogy minden szükséges mező megérkezett-e
        if (!empty($data->gepid) && !empty($data->szoftverid) && !empty($data->verzio) && !empty($data->datum)) {
            try {
                // Prepared statement használata az SQL Injection ellen
                $stmt = $conn->prepare("INSERT INTO telepites (gepid, szoftverid, verzio, datum) VALUES (?, ?, ?, ?)");
                
                if ($stmt->execute([$data->gepid, $data->szoftverid, $data->verzio, $data->datum])) {
                    echo json_encode(["success" => true, "message" => "Új telepítés sikeresen rögzítve!"]);
                } else {
                    echo json_encode(["success" => false, "message" => "Sikertelen mentés az adatbázisba."]);
                }
            } catch(PDOException $e) {
                echo json_encode(["success" => false, "message" => "SQL hiba a mentésnél: " . $e->getMessage()]);
            }
        } else {
            echo json_encode(["success" => false, "message" => "Sikertelen mentés: Hiányos adatok érkeztek."]);
        }
        break;

    // ==========================================
    // UPDATE (PUT) - Meglévő telepítés adatainak módosítása
    // ==========================================
    case 'PUT':
        $data = json_decode(file_get_contents("php://input"));
        
        if (!empty($data->gepid) && !empty($data->szoftverid) && !empty($data->verzio) && !empty($data->datum)) {
            try {
                // A verzió és dátum frissítése a pontos összetett kulcs (gepid, szoftverid) alapján
                $stmt = $conn->prepare("UPDATE telepites SET verzio = ?, datum = ? WHERE gepid = ? AND szoftverid = ?");
                
                if ($stmt->execute([$data->verzio, $data->datum, $data->gepid, $data->szoftverid])) {
                    echo json_encode(["success" => true, "message" => "A bejegyzés sikeresen frissítve!"]);
                } else {
                    echo json_encode(["success" => false, "message" => "Nem történt módosítás."]);
                }
            } catch(PDOException $e) {
                echo json_encode(["success" => false, "message" => "SQL hiba a módosításnál: " . $e->getMessage()]);
            }
        } else {
            echo json_encode(["success" => false, "message" => "Sikertelen módosítás: Hiányos adatok."]);
        }
        break;

    // ==========================================
    // DELETE (DELETE) - Telepítési rekord törlése
    // ==========================================
    case 'DELETE':
        $data = json_decode(file_get_contents("php://input"));
        
        // A törléshez tudnunk kell, melyik gépből és melyik szoftverkapcsolatot töröljük
        if (!empty($data->gepid) && !empty($data->szoftverid)) {
            try {
                $stmt = $conn->prepare("DELETE FROM telepites WHERE gepid = ? AND szoftverid = ?");
                
                if ($stmt->execute([$data->gepid, $data->szoftverid])) {
                    echo json_encode(["success" => true, "message" => "Telepítési bejegyzés sikeresen törölve!"]);
                } else {
                    echo json_encode(["success" => false, "message" => "A törlendő rekord nem található."]);
                }
            } catch(PDOException $e) {
                echo json_encode(["success" => false, "message" => "SQL hiba a törlés során: " . $e->getMessage()]);
            }
        } else {
            echo json_encode(["success" => false, "message" => "Sikertelen törlés: Hiányzó azonosítók."]);
        }
        break;
        
    default:
        echo json_encode(["message" => "Nem támogatott HTTP metódus."]);
        break;
}
?>