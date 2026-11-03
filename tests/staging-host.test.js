import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {privateStagingConfig} from '../scripts/start-private-staging.js';
import {createApp} from '../src/server.js';
import {fixture} from './helpers.js';

const synthetic={NODE_ENV:'production',HOST:'0.0.0.0',PORT:'10000',ERP_DATABASE_PROVIDER:'supabase',ERP_STAGING_SYNTHETIC_ONLY:'true',ERP_JOBS_ENABLED:'false',ERP_TRANSPORTS_ENABLED:'false',ERP_SECURE_COOKIES:'true',ERP_PUBLIC_ORIGIN:'https://staging.example.test',ERP_PROXY_SECRET:'synthetic-proxy-secret-for-test-only-2026',ERP_POSTGRES_TLS:'true',ERP_POSTGRES_CONNECTION_MODE:'session',ERP_POSTGRES_URL:'postgresql://synthetic:synthetic@db.example.test:5432/synthetic',ERP_MASTER_KEY:'a'.repeat(64)};

test('hosted staging validates secure PostgreSQL configuration without contacting the database',()=>{
  const config=privateStagingConfig(synthetic);assert.equal(config.host,'0.0.0.0');assert.equal(config.port,10000);assert.equal(config.secureCookies,true);assert.equal(config.jobs.enabled,false);
});

test('hosted staging rejects fallback, external delivery, unsafe transport and incomplete secrets',()=>{
  for(const change of [{ERP_DATABASE_PROVIDER:undefined},{ERP_DATABASE_PROVIDER:'sqlite'},{ERP_STAGING_SYNTHETIC_ONLY:'false'},{ERP_JOBS_ENABLED:'true'},{ERP_TRANSPORTS_ENABLED:'true'},{ERP_SECURE_COOKIES:'false'},{ERP_POSTGRES_TLS:'false'},{ERP_PROXY_SECRET:''},{ERP_POSTGRES_URL:undefined},{ERP_MASTER_KEY:'invalid'},{ERP_PUBLIC_ORIGIN:'https://staging.example.test/api'},{HOST:'127.0.0.1'}])assert.throws(()=>privateStagingConfig({...synthetic,...change}));
});

test('hosted staging rejects invalid session cookies before opening the database',()=>{
  for(const cookie of ['solio_staging_session','erp_bad;cookie','erp_BAD','erp_'+ 'x'.repeat(49)])assert.throws(()=>privateStagingConfig({...synthetic,ERP_SESSION_COOKIE:cookie}),/Invalid application session cookie name/);
});

test('hosted password-only administrator configuration is limited to one synthetic account with transports disabled',()=>{
  const setting={ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL:'staging-admin@example.test'};
  assert.doesNotThrow(()=>privateStagingConfig({...synthetic,...setting}));
  for(const change of [{ERP_STAGING_SYNTHETIC_ONLY:'false'},{ERP_TRANSPORTS_ENABLED:'true'},{ERP_TRANSPORTS_ENABLED:undefined},{ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL:'first@example.test,second@example.test'},{ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL:'*'}])assert.throws(()=>privateStagingConfig({...synthetic,...setting,...change}));
});

test('hosted staging Blueprint cookie starts the server and isolates secure login from other ERP sessions',async()=>{
  const blueprint=readFileSync(new URL('../render.yaml',import.meta.url),'utf8'),sessionCookie=/key: ERP_SESSION_COOKIE\r?\n\s+value: (\S+)/.exec(blueprint)?.[1];
  assert.ok(sessionCookie,'Blueprint must explicitly configure an isolated cookie');
  privateStagingConfig({...synthetic,ERP_SESSION_COOKIE:sessionCookie});
  const f=fixture();let server;
  try{
    server=createApp(f.db,{sessionCookie,secureCookies:true,publicOrigin:synthetic.ERP_PUBLIC_ORIGIN,proxySecret:synthetic.ERP_PROXY_SECRET});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,headers={'X-Origin-Secret':synthetic.ERP_PROXY_SECRET,'Content-Type':'application/json'};
    const response=await fetch(origin+'/api/login',{method:'POST',headers,body:JSON.stringify({email:'admin@demo.erp',password:'Demo-only-2026!'})});
    assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');
    assert.ok(cookie.startsWith(sessionCookie+'='));assert.match(cookie,/; Secure/);assert.match(cookie,/; HttpOnly/);assert.match(cookie,/; SameSite=Strict/);
    const pair=cookie.split(';')[0];
    assert.equal((await fetch(origin+'/api/config',{headers:{...headers,Cookie:pair}})).status,200);
    assert.equal((await fetch(origin+'/api/config',{headers:{...headers,Cookie:'erp_session='+pair.slice(pair.indexOf('=')+1)}})).status,401);
  }finally{if(server){await server.jobs.stop();server.closeAllConnections();await new Promise(r=>server.close(r));}f.cleanup();}
});

test('starting hosted staging without a provider fails before creating a SQLite ledger',()=>{
  const dir=mkdtempSync(join(tmpdir(),'solio-staging-')),database=join(dir,'must-not-exist.sqlite');
  try{const env={...process.env,ERP_DB:database,ERP_DATABASE_PROVIDER:''};const result=spawnSync(process.execPath,[resolve('scripts/start-private-staging.js')],{cwd:dir,env,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(result.status,1);assert.match(result.stderr,/SQLite fallback is prohibited/);assert.equal(existsSync(database),false);}finally{rmSync(dir,{recursive:true,force:true});}
});
