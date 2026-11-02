import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {restrictFile} from '../src/private-files.js';
import {startPostgres} from '../src/postgres-runtime.js';
const config=JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')),path='artifacts/postgres-local-staging-session.json';
let selection;if(existsSync(path)&&!process.argv.includes('--new'))selection=JSON.parse(readFileSync(path,'utf8'));
else{const proof=JSON.parse(readFileSync('artifacts/postgres-migration-recovery.json','utf8'));if(!proof.passed||!proof.outbound_blocked||!proof.destination?.database)throw Error('A successful isolated PostgreSQL recovery rehearsal is required');selection={database:proof.destination.database,schema:proof.destination.schema,record_key_file:proof.source.path+'.key'};}
if(!/^recovery_[a-f0-9]{32}$/.test(selection.database)||!/^recovery_[a-f0-9]{32}$/.test(selection.schema))throw Error('Local staging permits only the isolated recovery rehearsal database');
const url=new URL(config.application);if(url.hostname!=='127.0.0.1'||url.port!=='55432')throw Error('Local synthetic staging cannot select a remote or saved database');url.pathname='/'+selection.database;
const secret=resolve('.cache/postgres/private-staging-url.key');writeFileSync(secret,url.href,{mode:0o600});restrictFile(secret);
for(const name of ['ERP_POSTGRES_URL','ERP_PUBLIC_ORIGIN','ERP_PROXY_SECRET','ERP_OIDC_ISSUER','ERP_OIDC_CLIENT_ID','ERP_MASTER_KEY'])delete process.env[name];
Object.assign(process.env,{ERP_DATABASE_PROVIDER:'postgres',ERP_POSTGRES_URL_FILE:secret,ERP_POSTGRES_SCHEMA:selection.schema,ERP_MASTER_KEY_FILE:selection.record_key_file,ERP_STAGING_SYNTHETIC_ONLY:'true',NODE_ENV:'development',HOST:'127.0.0.1',PORT:'3005',ERP_JOBS_ENABLED:'false',ERP_TRANSPORTS_ENABLED:'false',ERP_SESSION_COOKIE:'erp_postgres_staging_session'});
const {server,db}=await startPostgres();const record={...selection,started_at:new Date().toISOString(),pid:process.pid,url:'http://127.0.0.1:3005',build:JSON.parse(readFileSync('package.json','utf8')).version,provider:'postgres',synthetic:true,jobs_enabled:false,transports_enabled:false,session_cookie:'erp_postgres_staging_session',scope:'local synthetic rehearsal, not a deployed Supabase service or human acceptance'};
writeFileSync(path,JSON.stringify(record,null,2));console.log(JSON.stringify({url:record.url,provider:record.provider,synthetic:true,pid:record.pid}));
