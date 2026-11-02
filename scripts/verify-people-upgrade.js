import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {backupDatabase} from '../src/backup.js';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';

// Takes a paired, non-overwriting backup and upgrades a second copy. Never migrates the source.
const source=resolve(process.argv[2]||'data/erp.sqlite'),backup=resolve(process.argv[3]||'data/backup-before-0.7.0.sqlite'),preview=resolve(process.argv[4]||'data/preview-0.7.0.sqlite');
backupDatabase(source,backup);backupDatabase(backup,preview);
const before=new DatabaseSync(backup,{readOnly:true}),snapshot=db=>Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations' ORDER BY name").all().map(({name})=>{const rows=db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all();return[name,{rows:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}];}));
let old;try{old=snapshot(before);}finally{before.close();}
const upgraded=openDatabase(preview);try{const current=snapshot(upgraded),changed=Object.keys(old).filter(k=>JSON.stringify(old[k])!==JSON.stringify(current[k]));if(changed.length)throw new Error('Migration modified existing business tables: '+changed.join(', '));const erp=new ERP(upgraded),result={source,backup,preview,existing_tables_preserved:Object.keys(old).length,existing_rows_preserved:Object.values(old).reduce((n,t)=>n+t.rows,0),schema:erp.get('SELECT COUNT(*) AS n FROM schema_migrations').n,integrity:erp.get('PRAGMA integrity_check').integrity_check,foreign_key_errors:erp.all('PRAGMA foreign_key_check').length,projects:erp.all('SELECT id FROM projects').map(p=>({id:p.id,metrics:erp.metrics(p.id)})),tables:old};writeFileSync('artifacts/stage5-migration-preview.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,tables:undefined},null,2));if(result.schema!==10||result.integrity!=='ok'||result.foreign_key_errors)throw new Error('Upgrade validation failed');}finally{upgraded.close();}
