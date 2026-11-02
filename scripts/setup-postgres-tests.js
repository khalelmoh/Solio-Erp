import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {restrictFile} from '../src/private-files.js';
if(process.env.ERP_PG_DISPOSABLE!=='true')throw Error('Set ERP_PG_DISPOSABLE=true only for the explicitly disposable local PostgreSQL instance');
mkdirSync('.cache/postgres',{recursive:true});
if(existsSync('.cache/postgres/test.env.json')){console.log('Existing isolated PostgreSQL test configuration preserved.');}
else{
  const owner=process.env.ERP_PG_TEST_OWNER_URL_FILE?readFileSync(process.env.ERP_PG_TEST_OWNER_URL_FILE,'utf8').trim():'postgresql://erp_owner:'+readFileSync('.cache/postgres/owner.key','utf8').trim()+'@127.0.0.1:55432/postgres',url=new URL(owner);
  if(!['127.0.0.1','[::1]'].includes(url.hostname))throw Error('Test setup permits loopback disposable PostgreSQL only, never a Supabase or real-record server');
  for(const file of ['record.key','backup.key'])if(!existsSync('.cache/postgres/'+file)){writeFileSync('.cache/postgres/'+file,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});restrictFile('.cache/postgres/'+file);}
  const role='erp_test_'+randomBytes(8).toString('hex'),password=randomBytes(32).toString('hex'),client=new pg.Client({connectionString:owner});await client.connect();
  try{await client.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='erp_backend') THEN CREATE ROLE erp_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF; END $$");await client.query('CREATE ROLE '+role+" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '"+password+"'");await client.query('GRANT erp_backend TO '+role);url.username=role;url.password=password;const path='.cache/postgres/test.env.json';writeFileSync(path,JSON.stringify({owner,application:url.href,key_file:'.cache/postgres/record.key'}),{flag:'wx',mode:0o600});restrictFile(path);console.log('Disposable PostgreSQL test configuration created; no credentials printed.');}finally{await client.end();}
}
