#!/usr/bin/env bash
# Target procedure; requires actual PostgreSQL tools, age, credentials and a reviewed test alert sink.
# Does not claim that the current ERP PostgreSQL adapter or a target deployment exists.
set -euo pipefail
umask 077
temporary=''
finish() {
  result=$?
  if [[ -n "$temporary" ]]; then
    rm -f -- "$temporary/database.dump" "$temporary/archive.age" || true
    rmdir -- "$temporary" || true
  fi
  if (( result != 0 )); then
    if [[ -n "${ERP_BACKUP_STATUS_FILE:-}" ]]; then
      printf '{"ok":false,"checked_at":"%s","error":"Staging PostgreSQL encrypted backup failed"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ERP_BACKUP_STATUS_FILE" || true
    fi
    if [[ "${ERP_BACKUP_ALERT_TEST_ONLY:-}" = true && -f "${ERP_BACKUP_ALERT_CONFIG_FILE:-}" ]]; then
      printf '{"event":"staging.backup.failed","scope":"synthetic staging"}' | curl --fail --silent --show-error --max-time 20 --config "$ERP_BACKUP_ALERT_CONFIG_FILE" --data-binary @- || true
    fi
  fi
  exit "$result"
}
trap finish EXIT
: "${PGSERVICEFILE:?Protected PostgreSQL service file required}"
: "${PGPASSFILE:?Protected PostgreSQL password file required}"
: "${ERP_BACKUP_AGE_RECIPIENT:?Public age recipient required; keep its private recovery key off-host}"
: "${ERP_BACKUP_DIR:?Dedicated staging backup directory required}"
: "${ERP_BACKUP_STATUS_FILE:?Private backup status path required}"
[[ "${ERP_STAGING_SYNTHETIC_ONLY:-}" = true ]] || exit 1
[[ "${ERP_BACKUP_SERVICE:-}" = erp_staging ]] || { echo 'Use the staging-only service definition' >&2; exit 1; }
command -v pg_dump >/dev/null
command -v age >/dev/null
mkdir -p -- "$ERP_BACKUP_DIR"
directory=$(realpath -- "$ERP_BACKUP_DIR")
[[ "$directory" = /var/backups/erp-staging ]] || { echo 'Use the dedicated staging backup path' >&2; exit 1; }
temporary=$(mktemp -d "$directory/.capture.XXXXXX")
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# PGSERVICEFILE must specify the actual staging host/db and sslmode=verify-full.
pg_dump --dbname=service=erp_staging --format=custom --file="$temporary/database.dump"
age --recipient "$ERP_BACKUP_AGE_RECIPIENT" --output "$temporary/archive.age" "$temporary/database.dump"
archive="$directory/staging-$(date -u +%Y%m%dT%H%M%SZ)-${temporary##*.}.pgdump.age"
ln -- "$temporary/archive.age" "$archive"
printf '{"ok":true,"checked_at":"%s","captured_at":"%s","kind":"postgres-custom-age","bytes":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$started" "$(stat -c %s "$archive")" > "$ERP_BACKUP_STATUS_FILE"
printf 'Encrypted staging PostgreSQL archive completed. Offsite delivery and restoration require separate verification.\n'
