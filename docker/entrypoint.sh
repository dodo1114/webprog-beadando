#!/bin/sh
set -eu

ENV_FILE="/var/www/html/backend/.env"
UPLOADS_DIR="/var/www/html/backend/public/uploads"

mkdir -p "$UPLOADS_DIR"
chown -R www-data:www-data "$UPLOADS_DIR"

cat >"$ENV_FILE" <<EOF
DB_DSN=mysql:host=${DB_HOST:-db};port=${DB_PORT:-3306};dbname=${DB_NAME:-software_inventory};charset=utf8mb4
DB_USER=${DB_USER:-web1_user}
DB_PASSWORD=${DB_PASSWORD:-web1_docker_password}
DB_TABLE=${DB_TABLE:-software_items}
PORTAL_CHECKER_FAMILY_NAME=${PORTAL_CHECKER_FAMILY_NAME:-}
PORTAL_CHECKER_GIVEN_NAME=${PORTAL_CHECKER_GIVEN_NAME:-}
PORTAL_CHECKER_LOGIN=${PORTAL_CHECKER_LOGIN:-}
PORTAL_CHECKER_PASSWORD=${PORTAL_CHECKER_PASSWORD:-}
EOF

chown www-data:www-data "$ENV_FILE"
chmod 640 "$ENV_FILE"

php /var/www/html/backend/scripts/bootstrap_database.php >/dev/null

exec "$@"
