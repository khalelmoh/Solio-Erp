import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
const proof=JSON.parse(readFileSync('artifacts/stage6-upgrade-preview.json','utf8')),source=proof.source;
const hash=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const verify=(db,upgraded=false)=>{for(const [table,entry]of Object.entries(proof.table_hashes)){const rows=db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all(),prior=rows.slice(0,entry.rows).map(r=>Object.fromEntries(entry.columns.map(c=>[c,r[c]])));assert.equal(hash(prior),entry.sha256,table+' changed after rehearsal');assert.equal(rows.length,entry.rows+(upgraded&&table==='controls'?1:0),table+' row count changed');}};
const before=new DatabaseSync(source,{readOnly:true});try{verify(before);}finally{before.close();}
const db=openDatabase(source);try{
  verify(db,true);const e=new ERP(db),projects=e.all('SELECT id FROM projects').map(p=>({id:p.id,metrics:e.metrics(p.id)}));assert.deepEqual(projects,proof.projects);assert.ok(readFileSync(source+'.key').equals(readFileSync(proof.backup+'.key')));for(const emp of e.all('SELECT id FROM employees'))e.employee(e.get('SELECT id FROM users WHERE admin=1 ORDER BY id LIMIT 1').id,emp.id);
  const result={version:'0.9.0',schema:e.get('SELECT COUNT(*) AS n FROM schema_migrations').n,integrity:e.get('PRAGMA integrity_check').integrity_check,foreign_key_errors:e.all('PRAGMA foreign_key_check').length,preserved_rows:proof.preserved_rows,preserved_tables:proof.preserved_tables,key_unchanged:true,employees:e.get('SELECT COUNT(*) AS n FROM employees').n,projects,configuration:'Existing local roles, disabled privileged-MFA flag, provisional policy, retention and .env preserved; no financial/employee test records added'};assert.equal(result.schema,12);assert.equal(result.integrity,'ok');assert.equal(result.foreign_key_errors,0);writeFileSync('artifacts/migration-0.9.0.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{db.close();}
