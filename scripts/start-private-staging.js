import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runtimeConfig,validateSessionCookieName} from '../src/runtime.js';
import {postgresOptions} from '../src/postgres-db.js';

// Dedicated hosted-staging entry point. Never initialize or choose a local ledger.
export function privateStagingConfig(env=process.env){
  if(!['postgres','supabase'].includes(env.ERP_DATABASE_PROVIDER))throw Error('Private staging requires explicitly selected PostgreSQL; SQLite fallback is prohibited');
  if(env.NODE_ENV!=='production'||env.ERP_STAGING_SYNTHETIC_ONLY!=='true')throw Error('Private staging requires production transport controls and synthetic-only records');
  if(env.ERP_TRANSPORTS_ENABLED!=='false'||env.ERP_JOBS_ENABLED!=='false')throw Error('Initial private staging requires disabled transports and background jobs');
  if(!env.ERP_PROXY_SECRET||env.ERP_PROXY_SECRET.length<32)throw Error('Configure a private ERP_PROXY_SECRET of at least 32 characters on the backend and Vercel');
  if(env.ERP_POSTGRES_TLS!=='true')throw Error('Hosted PostgreSQL requires verified TLS');
  validateSessionCookieName(env.ERP_SESSION_COOKIE||'erp_postgres_session');
  const config=runtimeConfig(env);
  if(config.host!=='0.0.0.0')throw Error('Hosted staging must bind HOST=0.0.0.0');
  const origin=new URL(env.ERP_PUBLIC_ORIGIN);
  if(origin.pathname!=='/'||origin.search||origin.hash||['localhost','127.0.0.1'].includes(origin.hostname))throw Error('ERP_PUBLIC_ORIGIN must be the frontend HTTPS origin without a path');
  postgresOptions(env);
  const key=env.ERP_MASTER_KEY_FILE?readFileSync(env.ERP_MASTER_KEY_FILE,'utf8').trim():env.ERP_MASTER_KEY;
  if(!/^[a-f\d]{64}$/i.test(key||''))throw Error('Configure a stable external 64-hex-character record key; do not regenerate it on release');
  return config;
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  privateStagingConfig();
  await(await import('../src/postgres-runtime.js')).startPostgres();
}
