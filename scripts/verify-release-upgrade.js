import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {backupDatabase} from '../src/backup.js';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
import {restrictFile} from '../src/private-files.js';
const source=resolve(process.argv[2]||'data/erp.sqlite'),backup=resolve(process.argv[3]||'data/backup-before-0.9.0.sqlite'),preview=resolve(process.argv[4]||'data/preview-0.9.0.sqlite');
backupDatabase(source,backup);restrictFile(backup);restrictFile(backup+'.key');backupDatabase(backup,preview);restrictFile(preview);restrictFile(preview+'.key');
const snapshot=db=>Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations' ORDER BY name").all().map(({name})=>[name,db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
const oldDb=new DatabaseSync(backup,{readOnly:true});let old,projects;try{old=snapshot(oldDb);const erp=new ERP(oldDb);projects=erp.all('SELECT id FROM projects').map(p=>({id:p.id,metrics:erp.metrics(p.id)}));}finally{oldDb.close();}
const db=openDatabase(preview);try{
  const current=snapshot(db),changed=[];for(const [table,rows]of Object.entries(old)){const cols=rows.length?Object.keys(rows[0]):[];if(JSON.stringify(rows)!==JSON.stringify(current[table].slice(0,rows.length).map(r=>Object.fromEntries(cols.map(k=>[k,r[k]])))))changed.push(table);if(current[table].length!==rows.length&&!(table==='controls'&&current[table].length===rows.length+1&&current[table].at(-1).name==='privileged_mfa_required'))changed.push(table+' unexpected append');}
  if(changed.length)throw Error('Existing records changed: '+changed.join(', '));const erp=new ERP(db),after=erp.all('SELECT id FROM projects').map(p=>({id:p.id,metrics:erp.metrics(p.id)}));if(JSON.stringify(after)!==JSON.stringify(projects))throw Error('Financial balances changed');for(const e of erp.all('SELECT id FROM employees'))erp.employee(erp.get('SELECT id FROM users WHERE admin=1 ORDER BY id LIMIT 1').id,e.id);
  const proof={source,backup,preview,schema:erp.get('SELECT COUNT(*) AS n FROM schema_migrations').n,integrity:erp.get('PRAGMA integrity_check').integrity_check,foreign_key_errors:erp.all('PRAGMA foreign_key_check').length,key_unchanged:readFileSync(backup+'.key').equals(readFileSync(preview+'.key')),preserved_tables:Object.keys(old).length,preserved_rows:Object.values(old).reduce((n,r)=>n+r.length,0),permitted_changes:'Appended session/SSO assurance columns with safe defaults and one disabled privileged-MFA control; no earlier values changed',projects:after,table_hashes:Object.fromEntries(Object.entries(old).map(([t,rows])=>[t,{rows:rows.length,columns:rows.length?Object.keys(rows[0]):[],sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}]))};
  if(proof.schema!==12||proof.integrity!=='ok'||proof.foreign_key_errors||!proof.key_unchanged)throw Error('Upgrade validation failed');writeFileSync('artifacts/stage6-upgrade-preview.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({...proof,table_hashes:undefined},null,2));
}finally{db.close();}
