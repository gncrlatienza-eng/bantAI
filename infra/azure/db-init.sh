#!/bin/sh
set -eu

: "${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required}"
: "${DATABASE_APP_PASSWORD:?DATABASE_APP_PASSWORD is required}"

exec psql "$DATABASE_ADMIN_URL" \
  --set=ON_ERROR_STOP=1 \
  --set=app_password="$DATABASE_APP_PASSWORD" \
  --file=/opt/bantai/db-init.sql
