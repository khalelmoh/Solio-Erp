import {DatabaseSync} from 'node:sqlite';
import {readFileSync,realpathSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,basename,dirname,sep} from 'node:path';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {migratePostgres} from './postgres-migrations.js';
import {restrictFile} from './private-files.js';
const hash=x=>createHash('sha256').update(x).digest('hex');
const encode=v=>Buffer.isBuffer(v)||v instanceof Uint8Array?{bytea:Buffer.from(v).toString('base64')}:v;
const normalize=rows=>rows.map(row=>Object.fromEntries(Object.keys(row).sort().map(k=>[k,encode(row[k])]))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
const digest=tables=>tables.map(t=>({name:t.name,count:t.rows.length,sha256:hash(JSON.stringify(normalize(t.rows)))}));
export function snapshotSyntheticSqlite(path){
  const file=realpathSync(path),root=realpathSync('.cache');if(!file.startsWith(root+sep)||!/^postgres-synthetic-[a-f0-9-]+\.sqlite$/.test(basename(file)))throw Error('Only an isolated .cache/postgres-synthetic-UUID.sqlite rehearsal source is authorized');
  const db=new DatabaseSync(file,{readOnly:true});try{db.exec('BEGIN');if(db.prepare('SELECT COUNT(*) AS n FROM projects WHERE demo<>1').get().n)throw Error('Migration rehearsal requires synthetic labelled projects only');const catalog={tables:JSON.parse(readFileSync(new URL('./postgres-catalog.json',import.meta.url),'utf8'))},tables=catalog.tables.map(t=>({name:t.name,columns:t.columns,rows:db.prepare('SELECT * FROM "'+t.name+'"').all().map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,encode(v)])))}));const checks={integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,foreign_keys:db.prepare('PRAGMA foreign_key_check').all().length};if(checks.integrity!=='ok'||checks.foreign_keys)throw Error('Invalid synthetic SQLite source');db.exec('COMMIT');return{format:1,source:'sqlite',captured_at:new Date().toISOString(),source_file_sha256:hash(readFileSync(file)),record_key:readFileSync(file+'.key','utf8').trim(),checks,tables,counts:digest(tables)};}finally{db.close();}
}
export async function snapshotPostgres(db){return db.withSession(async()=>{await db.exec('BEGIN');try{const catalog={tables:JSON.parse(readFileSync(new URL('./postgres-catalog.json',import.meta.url),'utf8'))},tables=[];for(const t of catalog.tables){const rows=(await db.query('SELECT * FROM "'+t.name+'"')).rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,encode(v)])));tables.push({name:t.name,columns:t.columns,rows});}const result={format:1,source:'postgres',captured_at:new Date().toISOString(),schema:db.schema,record_key:db.erpMasterKey.toString('hex'),tables,counts:digest(tables),migrations:(await db.query('SELECT name,sha256 FROM pg_migrations ORDER BY name')).rows};await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}});}
export async function importPostgresSnapshot(db,snapshot,{quarantine=false}={}){
  if(snapshot.format!==1||!/^[a-f\d]{64}$/i.test(snapshot.record_key)||JSON.stringify(digest(snapshot.tables))!==JSON.stringify(snapshot.counts))throw Error('Snapshot data/hash/key validation failed');
  if((await db.query('SELECT 1 FROM information_schema.schemata WHERE schema_name=$1',[db.schema])).rows.length)throw Error('Restore/import requires a distinct unused schema; overwrite prohibited');
  db.erpMasterKey=Buffer.from(snapshot.record_key,'hex');await migratePostgres(db,{snapshot});
  const after=await snapshotPostgres(db);if(JSON.stringify(after.counts)!==JSON.stringify(snapshot.counts))throw Error('Imported PostgreSQL record counts or hashes do not match source');
  if(quarantine)await db.withSession(async()=>{await db.exec('BEGIN IMMEDIATE');try{await db.query('UPDATE release_environment SET quarantined=1 WHERE id=1');for(const table of ['sessions','auth_resets','oidc_attempts'])await db.query('DELETE FROM '+table);await db.exec('COMMIT');}catch(e){await db.exec('ROLLBACK');throw e;}});
  return{source:snapshot.source,snapshot_at:snapshot.captured_at,tables:after.counts,exact_hashes_match:true,quarantined:quarantine,record_key_fingerprint:hash(db.erpMasterKey)};
}
const magic=Buffer.from('FOLIO-POSTGRES-BACKUP-1\n');
export async function backupPostgres(db,destination,{keyFile,maxBytes=67108864}={}){
  if(existsSync(destination))throw Error('Backup destination already exists');const key=Buffer.from(readFileSync(keyFile,'utf8').trim(),'hex');if(key.length!==32||key.equals(db.erpMasterKey))throw Error('Use a separate 32-byte backup key');const snapshot=await snapshotPostgres(db),payload=Buffer.from(JSON.stringify(snapshot));if(payload.length>maxBytes)throw Error('Logical backup exceeds configured memory bound; use the reviewed pg_dump/PITR procedure');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic);const data=Buffer.concat([cipher.update(payload),cipher.final()]);writeFileSync(destination,Buffer.concat([magic,iv,cipher.getAuthTag(),data]),{flag:'wx',mode:0o600});restrictFile(destination);return{captured_at:snapshot.captured_at,bytes:data.length,sha256:hash(readFileSync(destination)),tables:snapshot.counts,keys:'record key encrypted in archive; independent backup key required',scope:'application private schema; Supabase Auth/Storage are not used'};
}
export async function restorePostgres(db,archive,{keyFile}={}){
  const bytes=readFileSync(archive);if(!bytes.subarray(0,magic.length).equals(magic))throw Error('Invalid PostgreSQL archive');const key=Buffer.from(readFileSync(keyFile,'utf8').trim(),'hex');if(key.length!==32)throw Error('Invalid backup key');const p=magic.length,decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(p,p+12));decipher.setAAD(magic);decipher.setAuthTag(bytes.subarray(p+12,p+28));const snapshot=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(p+28)),decipher.final()]).toString('utf8'));return importPostgresSnapshot(db,snapshot,{quarantine:true});
}
