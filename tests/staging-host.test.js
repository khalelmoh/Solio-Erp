import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {privateStagingConfig} from '../scripts/start-private-staging.js';

const synthetic={NODE_ENV:'production',HOST:'0.0.0.0',PORT:'10000',ERP_DATABASE_PROVIDER:'supabase',ERP_STAGING_SYNTHETIC_ONLY:'true',ERP_JOBS_ENABLED:'false',ERP_TRANSPORTS_ENABLED:'false',ERP_SECURE_COOKIES:'true',ERP_PUBLIC_ORIGIN:'https://staging.example.test',ERP_PROXY_SECRET:'synthetic-proxy-secret-for-test-only-2026',ERP_POSTGRES_TLS:'true',ERP_POSTGRES_CONNECTION_MODE:'session',ERP_POSTGRES_URL:'postgresql://synthetic:synthetic@db.example.test:5432/synthetic',ERP_MASTER_KEY:'a'.repeat(64)};

test('hosted staging validates secure PostgreSQL configuration without contacting the database',()=>{
  const config=privateStagingConfig(synthetic);assert.equal(config.host,'0.0.0.0');assert.equal(config.port,10000);assert.equal(config.secureCookies,true);assert.equal(config.jobs.enabled,false);
});

test('hosted staging rejects fallback, external delivery, unsafe transport and incomplete secrets',()=>{
  for(const change of [{ERP_DATABASE_PROVIDER:undefined},{ERP_DATABASE_PROVIDER:'sqlite'},{ERP_STAGING_SYNTHETIC_ONLY:'false'},{ERP_JOBS_ENABLED:'true'},{ERP_TRANSPORTS_ENABLED:'true'},{ERP_SECURE_COOKIES:'false'},{ERP_POSTGRES_TLS:'false'},{ERP_PROXY_SECRET:''},{ERP_POSTGRES_URL:undefined},{ERP_MASTER_KEY:'invalid'},{ERP_PUBLIC_ORIGIN:'https://staging.example.test/api'},{HOST:'127.0.0.1'}])assert.throws(()=>privateStagingConfig({...synthetic,...change}));
});

test('starting hosted staging without a provider fails before creating a SQLite ledger',()=>{
  const dir=mkdtempSync(join(tmpdir(),'solio-staging-')),database=join(dir,'must-not-exist.sqlite');
  try{const env={...process.env,ERP_DB:database,ERP_DATABASE_PROVIDER:''};const result=spawnSync(process.execPath,[resolve('scripts/start-private-staging.js')],{cwd:dir,env,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(result.status,1);assert.match(result.stderr,/SQLite fallback is prohibited/);assert.equal(existsSync(database),false);}finally{rmSync(dir,{recursive:true,force:true});}
});
