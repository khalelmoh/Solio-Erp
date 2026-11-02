import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {backupDatabase} from '../src/backup.js';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';

// Read-only source; paired non-overwriting backup, then migration of a separate copy.
const source=resolve(process.argv[2]||'data/erp.sqlite'),backup=resolve(process.argv[3]||'data/backup-before-0.8.0.sqlite'),preview=resolve(process.argv[4]||'data/preview-0.8.0.sqlite');
backupDatabase(source,backup);backupDatabase(backup,preview);
const before=new DatabaseSync(backup,{readOnly:true});
const snapshot=db=>Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations' ORDER BY name").all().map(({name})=>[name,db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]));
let old,metrics;try{old=snapshot(before);metrics=new ERP(before).all('SELECT id FROM projects').map(p=>({id:p.id,metrics:new ERP(before).metrics(p.id)}));}finally{before.close();}
const db=openDatabase(preview);try{
  const current=snapshot(db),changed=[];
  for(const [table,rows]of Object.entries(old)){
    if(JSON.stringify(rows)!==JSON.stringify(current[table].slice(0,rows.length)))changed.push(table);
    if(current[table].length!==rows.length&&!(table==='el_policies'&&current[table].length===rows.length+1&&current[table].at(-1).kind==='rehire'))changed.push(table+' unexpected append');
  }
  if(changed.length)throw Error('Existing rows changed: '+changed.join(', '));
  const erp=new ERP(db),projects=erp.all('SELECT id FROM projects').map(p=>({id:p.id,metrics:erp.metrics(p.id)}));if(JSON.stringify(projects)!==JSON.stringify(metrics))throw Error('Financial totals changed');
  for(const e of erp.all('SELECT id FROM employees'))erp.employee(erp.get('SELECT id FROM users WHERE admin=1 ORDER BY id LIMIT 1').id,e.id);
  const result={source,backup,preview,existing_tables_preserved:Object.keys(old).length,existing_rows_preserved:Object.values(old).reduce((n,r)=>n+r.length,0),permitted_append:'Default two-level rehire approval policy only',schema:erp.get('SELECT COUNT(*) AS n FROM schema_migrations').n,integrity:erp.get('PRAGMA integrity_check').integrity_check,foreign_key_errors:erp.all('PRAGMA foreign_key_check').length,key_unchanged:readFileSync(backup+'.key').equals(readFileSync(preview+'.key')),existing_employees:erp.get('SELECT COUNT(*) AS n FROM employees').n,projects,tables:Object.fromEntries(Object.entries(old).map(([t,r])=>[t,{rows:r.length,sha256:createHash('sha256').update(JSON.stringify(r)).digest('hex')}]))};
  writeFileSync('artifacts/operations-migration-preview.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,tables:undefined},null,2));if(result.schema!==11||result.integrity!=='ok'||result.foreign_key_errors||!result.key_unchanged)throw Error('Upgrade validation failed');
}finally{db.close();}
