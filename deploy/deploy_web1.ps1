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
if ! command -v mysql >/dev/null 2>&1; then
    apt-get update
    apt-get install -y mariadb-server mariadb-client php-mysql
fi
systemctl enable --now mariadb
rm -rf '$RemotePath'
mkdir -p '$RemotePath'
tar -xzf /root/_tmp_web1.tgz -C '$RemotePath'
PASSWORD_FILE='/root/.web1_db_password'
if [ ! -f "\$PASSWORD_FILE" ]; then
    openssl rand -hex 24 > "\$PASSWORD_FILE"
    chmod 600 "\$PASSWORD_FILE"
fi
DB_PASSWORD="\$(cat "\$PASSWORD_FILE")"
DB_NAME='software_inventory'
DB_USER='web1_user'
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`\$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
CREATE USER IF NOT EXISTS '\$DB_USER'@'127.0.0.1' IDENTIFIED BY '\$DB_PASSWORD';
ALTER USER '\$DB_USER'@'127.0.0.1' IDENTIFIED BY '\$DB_PASSWORD';
GRANT ALL PRIVILEGES ON \`\$DB_NAME\`.* TO '\$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
cat >'$RemotePath/backend/.env' <<EOF
DB_DSN=mysql:host=127.0.0.1;port=3306;dbname=\$DB_NAME;charset=utf8mb4
DB_USER=\$DB_USER
DB_PASSWORD=\$DB_PASSWORD
DB_TABLE=software_items
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
