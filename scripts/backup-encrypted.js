import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {defaultPath} from '../src/db.js';
import {encryptedBackup,pruneEncryptedBackups,archiveFilename} from '../src/recovery.js';
import {restrictFile} from '../src/private-files.js';
if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER)){await (await import('./postgres-tools.js')).postgresTool('backup',process.argv.slice(2));}else{
const statusPath=resolve(process.env.ERP_BACKUP_STATUS_FILE||'data/backup-status.json');let status;
try{const destination=process.argv[2]||join(process.env.ERP_BACKUP_DIR||'data/encrypted-backups',archiveFilename()),result=encryptedBackup(process.env.ERP_DB||defaultPath,destination,{configFile:process.env.ERP_BACKUP_CONFIG_FILE});if(process.env.ERP_BACKUP_RETENTION_DAYS)pruneEncryptedBackups(dirname(destination),{days:Number(process.env.ERP_BACKUP_RETENTION_DAYS)});status={ok:true,checked_at:new Date().toISOString(),captured_at:result.captured_at,bytes:result.bytes};console.log(JSON.stringify(result));}catch{status={ok:false,checked_at:new Date().toISOString(),error:'Encrypted backup failed; review storage, keys and job logs'};process.exitCode=1;console.error(status.error);}finally{mkdirSync(dirname(statusPath),{recursive:true});writeFileSync(statusPath,JSON.stringify(status,null,2),{mode:0o600});restrictFile(statusPath);}

}