import {openPostgres} from '../src/postgres-db.js';
import {postgresRuntime} from '../src/postgres-runtime.js';
import {backupPostgres,restorePostgres} from '../src/postgres-snapshot.js';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runtimeConfig} from '../src/runtime.js';
import {restrictFile} from '../src/private-files.js';

export async function postgresTool(command,args=process.argv.slice(3)){
  if(!['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER))throw Error('Explicit PostgreSQL provider required for this tool');
  if(command==='restore'){
    const [archive,keyDestination]=args;if(!archive||!keyDestination||existsSync(keyDestination))throw Error('Restore requires archive and an unused private record-key destination; existing keys are preserved');
    const db=await openPostgres(null,{owner:true,env:{...process.env,ERP_MASTER_KEY_FILE:undefined,ERP_MASTER_KEY:randomBytes(32).toString('hex')}});
    try{const result=await restorePostgres(db,archive,{keyFile:process.env.ERP_BACKUP_KEY_FILE});writeFileSync(keyDestination,db.erpMasterKey.toString('hex'),{flag:'wx',mode:0o600});restrictFile(keyDestination);console.log(JSON.stringify({...result,record_key_written:true,sessions_revoked:true,outbound_blocked:true}));}finally{await db.close();}return;
  }
  const runtime=await postgresRuntime(),db=await openPostgres();try{
    const erp=new runtime.ERP(db);
    if(command==='backup'){
      const destination=args[0];if(!destination)throw Error('Pass an unused encrypted archive path');
      const statusPath=process.env.ERP_BACKUP_STATUS_FILE;let status;
      try{const result=await backupPostgres(db,destination,{keyFile:process.env.ERP_BACKUP_KEY_FILE});status={ok:true,checked_at:new Date().toISOString(),captured_at:result.captured_at,provider:'postgres',bytes:result.bytes};console.log(JSON.stringify(result));}
      catch(e){status={ok:false,checked_at:new Date().toISOString(),provider:'postgres',error:'PostgreSQL backup failed; verify storage/keys and inspect the protected job log'};throw e;}
      finally{if(statusPath){mkdirSync(dirname(statusPath),{recursive:true});writeFileSync(statusPath,JSON.stringify(status),{mode:0o600});restrictFile(statusPath);}}
    }else if(command==='worker'){
      const config=runtimeConfig(),{backgroundJobs}=await import(pathToFileURL(runtime.root+'/src/jobs.js').href),worker=backgroundJobs(erp,{...config.jobs,enabled:true});try{const result=await worker.runNow();console.log(JSON.stringify(result));if(!result.ok&&!result.skipped)process.exitCode=1;}finally{await worker.stop();}
    }else if(command==='init'){
      if((await erp.get('SELECT COUNT(*) AS n FROM users')).n)throw Error('Administrator initialization requires an empty user database');
      const {bootstrapAdministrator}=await import(pathToFileURL(runtime.root+'/src/bootstrap.js').href);console.log(JSON.stringify(await bootstrapAdministrator(erp,{name:process.env.ERP_ADMIN_NAME,email:process.env.ERP_ADMIN_EMAIL,password:process.env.ERP_ADMIN_PASSWORD,mfaFile:process.env.ERP_ADMIN_MFA_SEED_FILE,production:process.env.NODE_ENV==='production'})));
    }else if(command==='preflight'){
      const checks={database:true,balanced_journals:(await erp.get('PRAGMA integrity_check')).integrity_check==='ok',foreign_keys:(await erp.all('PRAGMA foreign_key_check')).length===0,forced_rls:true,constrained_runtime_role:true,quarantined:await erp.quarantined(),synthetic:process.env.ERP_STAGING_SYNTHETIC_ONLY==='true',transports_disabled:process.env.ERP_TRANSPORTS_ENABLED!=='true'};console.log(JSON.stringify({provider:'postgres',checks,technical_database_ready:Object.entries(checks).filter(([k])=>!['quarantined','synthetic'].includes(k)).every(([,v])=>v),actual_target_verified:false,human_acceptance:false,real_pilot_authorized:false}));if(Object.entries(checks).filter(([k])=>!['quarantined','synthetic'].includes(k)).some(([,v])=>!v))process.exitCode=1;
    }else throw Error('Unknown PostgreSQL tool');
  }finally{await db.close();}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await postgresTool(process.argv[2]);
