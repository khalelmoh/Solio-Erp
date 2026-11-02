import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeConfig} from '../src/runtime.js';
import {openDatabase} from '../src/db.js';
import {fixture} from './helpers.js';
import {drainTransports} from '../src/transport.js';
import {backgroundJobs} from '../src/jobs.js';
import {verifyStagingPersistence} from '../scripts/staging-probe.js';
import {identityProvider} from '../src/identity.js';
test('unsupported Supabase provider fails before creating or migrating a SQLite database',()=>{
  const root=mkdtempSync(join(tmpdir(),'folio-provider-')),path=join(root,'must-not-exist.sqlite'),before=process.env.ERP_DATABASE_PROVIDER;
  try{assert.throws(()=>runtimeConfig({ERP_DATABASE_PROVIDER:'supabase'}),/refusing a silent SQLite fallback/);process.env.ERP_DATABASE_PROVIDER='supabase';assert.throws(()=>openDatabase(path),/not implemented/);assert.equal(existsSync(path),false);}
  finally{if(before===undefined)delete process.env.ERP_DATABASE_PROVIDER;else process.env.ERP_DATABASE_PROVIDER=before;rmdirSync(root);}
});
test('target persistence evidence rejects unchanged instances, lost money, changed attachments and missing source records',()=>{
  const before={origin:'https://staging.example.test',instance_id:'one',database_provider:'supabase',project:{id:3,code:'UAT-3'},metrics:{cash:'36000.00'},budget_ids:[2],request_ids:[2],transaction_ids:[4,5,6],attachment:{id:1,sha256:'synthetic-hash',bytes:20}},after={...before,instance_id:'two'};
  assert.equal(verifyStagingPersistence(before,after).passed,true);
  for(const change of [{instance_id:'one'},{metrics:{cash:'40000.00'}},{attachment:{id:1,sha256:'changed',bytes:20}},{transaction_ids:[4,5]}])assert.throws(()=>verifyStagingPersistence(before,{...after,...change}));
});
test('synthetic staging blocks provider access and deletion while permitting authorized local background scans',async()=>{
  const f=fixture(),before=process.env.ERP_STAGING_SYNTHETIC_ONLY;
  try{process.env.ERP_STAGING_SYNTHETIC_ONLY='true';assert.throws(()=>runtimeConfig({ERP_STAGING_SYNTHETIC_ONLY:'true',ERP_TRANSPORTS_ENABLED:'true'}),/requires.*false/);
    assert.throws(()=>f.erp.requireLiveEnvironment(),e=>e.status===503);await assert.rejects(drainTransports(f.erp),/synthetic staging/);assert.equal(f.erp.runRetention(f.demo.users.admin,{dry_run:false}).deleted.length,0);
    const oidcKeys=['ERP_OIDC_ISSUER','ERP_OIDC_CLIENT_ID','ERP_OIDC_REDIRECT_URI'],saved=oidcKeys.map(k=>process.env[k]);try{process.env.ERP_OIDC_ISSUER='https://idp.example.invalid';process.env.ERP_OIDC_CLIENT_ID='staging';process.env.ERP_OIDC_REDIRECT_URI='https://staging.example.invalid/api/oidc/callback';assert.equal(identityProvider(f.erp).enabled,false);}finally{oidcKeys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});}
    const jobs=backgroundJobs(f.erp,{enabled:true,actor:f.demo.users.admin,transportsEnabled:false});try{assert.equal((await jobs.runNow()).ok,true);}finally{await jobs.stop();}
  }finally{if(before===undefined)delete process.env.ERP_STAGING_SYNTHETIC_ONLY;else process.env.ERP_STAGING_SYNTHETIC_ONLY=before;f.cleanup();}
});
