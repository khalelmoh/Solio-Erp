#!/usr/bin/env bash
# Run only on the authorized private Node host. No target is provisioned here.
set -euo pipefail
release=${1:?Pass the prepared absolute release directory}
backend=${2:?Pass the protected backend environment file}
migrator=${3:?Pass the separate protected migration environment file}
[[ "$release" = /opt/erp-staging/releases/* ]] || { echo 'Use an isolated release directory' >&2; exit 1; }
cd -- "$release"
node --env-file="$backend" --input-type=module -e "import {runtimeConfig} from './src/runtime.js'; runtimeConfig(); if(!['supabase','postgres'].includes(process.env.ERP_DATABASE_PROVIDER)||process.env.ERP_STAGING_SYNTHETIC_ONLY!=='true'||process.env.ERP_TRANSPORTS_ENABLED==='true')throw Error('Private synthetic PostgreSQL staging required');"
# Before stopping an existing release: freeze posting, retain a successful encrypted
# backup receipt and complete the separate restore/migration rehearsal. An empty
# new staging schema must be verified by the release owner instead. No automatic
# database rollback or dual writer is introduced by this script.
npm ci
npm run check
npm run build:postgres
npm prune --omit=dev
systemctl stop erp-staging-api.service erp-staging-worker.timer
node --env-file="$migrator" scripts/postgres-migrate.js
node --env-file="$backend" scripts/postgres-tools.js preflight
ln -sfnT -- "$release" /opt/erp-staging/current
systemctl start erp-staging-api.service
systemctl is-active --quiet erp-staging-api.service
# Configure and test actual HTTPS/private access; verify persistence/source totals.
# Enable one worker schedule only after its account and disabled transports pass.
echo 'API started. Actual HTTPS, private access, persistence and recovery verification remain required.'
