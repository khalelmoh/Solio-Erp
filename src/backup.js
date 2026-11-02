import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,copyFileSync,constants} from 'node:fs';
import {resolve,dirname} from 'node:path';
export function backupDatabase(sourcePath,destinationPath){
  if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER))throw Error('PostgreSQL selected: use backup:postgres; reading the saved SQLite database is prohibited');
  const source=resolve(sourcePath),destination=resolve(destinationPath);
  if(!existsSync(source))throw new Error('Source database does not exist');
  if(source===destination||existsSync(destination)||existsSync(destination+'.key'))throw new Error('Choose an unused backup filename; existing files are preserved');
  mkdirSync(dirname(destination),{recursive:true});
  if(!process.env.ERP_MASTER_KEY&&!process.env.ERP_MASTER_KEY_FILE&&existsSync(source+'.key'))copyFileSync(source+'.key',destination+'.key',constants.COPYFILE_EXCL);
  const db=new DatabaseSync(source);try{db.exec('PRAGMA busy_timeout=10000');db.prepare('VACUUM INTO ?').run(destination);}finally{db.close();}
  return{destination,local_key_included:existsSync(destination+'.key')};
}
