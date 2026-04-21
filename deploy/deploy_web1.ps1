param(
    [string]$ServerHost = 'krakovszki.hu',
    [string]$User = 'root',
    [string]$RemotePath = '/var/www/html/web1',
    [string]$MountPath = '/web1',
    [string]$KeyPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ToolPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string[]]$Fallbacks = @()
    )

    $tool = Get-Command $Name -ErrorAction SilentlyContinue
    if ($tool) {
        return $tool.Source
    }

    foreach ($candidate in $Fallbacks) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "Required tool is missing: $Name"
}

function Resolve-KeyPath {
    param(
        [string]$RequestedKeyPath
    )

    if ($RequestedKeyPath -and (Test-Path -LiteralPath $RequestedKeyPath)) {
        return (Resolve-Path -LiteralPath $RequestedKeyPath).Path
    }

    $startupPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
    $matches = @(Get-ChildItem -LiteralPath $startupPath -Filter '*.ppk' -File -ErrorAction SilentlyContinue)

    if ($matches.Count -eq 1) {
        return $matches[0].FullName
    }

    throw 'SSH key not found. Pass -KeyPath or place exactly one .ppk file in Startup.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$gitPath = Resolve-ToolPath -Name 'git' -Fallbacks @(
    (Join-Path $repoRoot '.tools\MinGit\cmd\git.exe')
)
$pscpPath = Resolve-ToolPath -Name 'pscp'
$plinkPath = Resolve-ToolPath -Name 'plink'
$resolvedKey = Resolve-KeyPath -RequestedKeyPath $KeyPath
$asciiKey = Join-Path $repoRoot '_tmp_server_key.ppk'
$archivePath = Join-Path $repoRoot '_tmp_web1.tgz'
$target = "$User@$ServerHost"

Copy-Item -LiteralPath $resolvedKey -Destination $asciiKey -Force

try {
    & $gitPath -C $repoRoot archive --format=tar.gz --output $archivePath HEAD
    if ($LASTEXITCODE -ne 0) {
        throw 'git archive failed.'
    }

    & $pscpPath -batch -i $asciiKey $archivePath "${target}:/root/_tmp_web1.tgz"
    if ($LASTEXITCODE -ne 0) {
        throw 'Upload to server failed.'
    }

$remoteCommand = @"
set -e
export DEBIAN_FRONTEND=noninteractive
if ! command -v mysql >/dev/null 2>&1 || ! php -m | grep -qi '^mbstring$' || ! php -m | grep -qi '^pdo_mysql$'; then
    apt-get update
    apt-get install -y mariadb-server mariadb-client php-mysql php-mbstring
fi
systemctl enable --now mariadb
UPLOADS_BACKUP='/root/.web1_uploads_backup'
rm -rf "`$UPLOADS_BACKUP"
if [ -d '$RemotePath/backend/public/uploads' ]; then
    mkdir -p "`$UPLOADS_BACKUP"
    cp -a '$RemotePath/backend/public/uploads/.' "`$UPLOADS_BACKUP"/
fi
rm -rf '$RemotePath'
mkdir -p '$RemotePath'
tar -xzf /root/_tmp_web1.tgz -C '$RemotePath'
mkdir -p '$RemotePath/backend/public/uploads'
if [ -d "`$UPLOADS_BACKUP" ]; then
    cp -a "`$UPLOADS_BACKUP"/. '$RemotePath/backend/public/uploads'/
    rm -rf "`$UPLOADS_BACKUP"
fi
chown -R www-data:www-data '$RemotePath/backend/public/uploads'
chmod 775 '$RemotePath/backend/public/uploads'
PASSWORD_FILE='/root/.web1_db_password'
if [ ! -f "`$PASSWORD_FILE" ]; then
    openssl rand -hex 24 > "`$PASSWORD_FILE"
    chmod 600 "`$PASSWORD_FILE"
fi
DB_PASSWORD="`$(cat "`$PASSWORD_FILE")"
CHECKER_LOGIN_FILE='/root/.web1_checker_login'
CHECKER_PASSWORD_FILE='/root/.web1_checker_password'
if [ ! -f "`$CHECKER_LOGIN_FILE" ]; then
    printf 'web1check_%s\n' "`$(openssl rand -hex 4)" > "`$CHECKER_LOGIN_FILE"
    chmod 600 "`$CHECKER_LOGIN_FILE"
fi
if [ ! -f "`$CHECKER_PASSWORD_FILE" ]; then
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20 > "`$CHECKER_PASSWORD_FILE"
    printf '\n' >> "`$CHECKER_PASSWORD_FILE"
    chmod 600 "`$CHECKER_PASSWORD_FILE"
fi
CHECKER_LOGIN="`$(tr -d '\n\r' < "`$CHECKER_LOGIN_FILE")"
CHECKER_PASSWORD="`$(tr -d '\n\r' < "`$CHECKER_PASSWORD_FILE")"
mysql <<SQL
CREATE DATABASE IF NOT EXISTS software_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
CREATE USER IF NOT EXISTS 'web1_user'@'127.0.0.1' IDENTIFIED BY '`$DB_PASSWORD';
ALTER USER 'web1_user'@'127.0.0.1' IDENTIFIED BY '`$DB_PASSWORD';
GRANT ALL PRIVILEGES ON software_inventory.* TO 'web1_user'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
cat >'$RemotePath/backend/.env' <<EOF
DB_DSN=mysql:host=127.0.0.1;port=3306;dbname=software_inventory;charset=utf8mb4
DB_USER=web1_user
DB_PASSWORD=`$DB_PASSWORD
DB_TABLE=software_items
PORTAL_CHECKER_FAMILY_NAME=Ellenorzo
PORTAL_CHECKER_GIVEN_NAME=Felhasznalo
PORTAL_CHECKER_LOGIN=`$CHECKER_LOGIN
PORTAL_CHECKER_PASSWORD=`$CHECKER_PASSWORD
EOF
chown www-data:www-data '$RemotePath/backend/.env'
chmod 640 '$RemotePath/backend/.env'
cat >/etc/apache2/conf-available/web1.conf <<'EOF'
RedirectMatch 302 ^$MountPath$ $MountPath/
Alias $MountPath $RemotePath/backend/public
<Directory $RemotePath/backend/public>
    Options FollowSymLinks
    AllowOverride None
    Require all granted
    DirectoryIndex index.html index.php
    FallbackResource $MountPath/index.php
</Directory>
EOF
a2enconf web1 >/dev/null
a2enmod rewrite >/dev/null
systemctl reload apache2
php '$RemotePath/backend/scripts/bootstrap_database.php'
php -l '$RemotePath/backend/public/index.php'
curl -fsS 'http://127.0.0.1$MountPath/api/v1/health' >/dev/null
curl -fsS 'http://127.0.0.1$MountPath/api/v1/software' >/dev/null
curl -fsS 'http://127.0.0.1$MountPath/' >/dev/null
rm -f /root/_tmp_web1.tgz
"@

    & $plinkPath -batch -i $asciiKey $target $remoteCommand
    if ($LASTEXITCODE -ne 0) {
        throw 'Remote deployment failed.'
    }
} finally {
    Remove-Item -LiteralPath $archivePath -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $asciiKey -ErrorAction SilentlyContinue
}
