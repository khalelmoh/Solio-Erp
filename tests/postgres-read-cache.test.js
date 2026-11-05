import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PostgresDatabase} from '../src/postgres-db.js';

function fixture(){
  const calls=[],source={name:'Original',sequence:0},pool=new EventEmitter();
  pool.connect=async()=>{const c=new EventEmitter();c.release=()=>{};c.query=async(sql,args=[])=>{calls.push(sql);if(sql.startsWith('UPDATE users'))source.name=args[0];const rows=/^SELECT/i.test(sql)?[{id:args[0]||1,name:source.name,bytes:Buffer.from('private'),created:new Date('2026-01-01'),nested:{state:'original'},sequence:++source.sequence}]:[];return{rows,rowCount:rows.length};};return c;};pool.end=async()=>{};
  return{db:new PostgresDatabase(pool,{schema:'erp_private',key:Buffer.alloc(32)}),calls,source};
}
const select='SELECT * FROM users WHERE id=$1';
test('read-only snapshots reuse repeated metadata and return independent rows, dates and binary values',async()=>{
  const f=fixture();await f.db.withSession(async()=>{await f.db.exec('BEGIN');const first=await f.db.query(select,[1]);first.rows[0].name='Changed';first.rows[0].bytes[0]=0;first.rows[0].created.setFullYear(1999);first.rows[0].nested.state='changed';const second=await f.db.query(select,[1]);assert.equal(second.rows[0].name,'Original');assert.equal(second.rows[0].bytes.toString(),'private');assert.equal(second.rows[0].created.getUTCFullYear(),2026);assert.equal(second.rows[0].nested.state,'original');assert.equal(f.calls.filter(q=>q===select).length,1);await f.db.exec('COMMIT');});
});
test('writes and new snapshots always see new permission metadata; no cache crosses request boundaries',async()=>{
  const f=fixture();await f.db.withSession(async()=>{await f.db.exec('BEGIN');await f.db.query(select,[1]);await f.db.exec('COMMIT');await f.db.exec('BEGIN IMMEDIATE');await f.db.query(select,[1]);await f.db.query('UPDATE users SET name=$1',['Revised']);assert.equal((await f.db.query(select,[1])).rows[0].name,'Revised');await f.db.exec('COMMIT');await f.db.exec('BEGIN');assert.equal((await f.db.query(select,[1])).rows[0].name,'Revised');await f.db.exec('ROLLBACK');});
  f.source.name='Revoked';assert.equal((await f.db.query(select,[1])).rows[0].name,'Revoked');assert.equal((await f.db.query(select,[1])).rows[0].name,'Revoked');assert.equal(f.calls.filter(q=>q===select).length,6);
});
test('volatile functions, non-metadata queries, different parameters and session changes are not reused',async()=>{
  const f=fixture();await f.db.withSession(async()=>{await f.db.exec('BEGIN');for(const q of ['SELECT random() FROM users','SELECT CURRENT_TIMESTAMP FROM users','SELECT * FROM journal_lines','SELECT * FROM journal_lines WHERE EXISTS(SELECT 1 FROM users WHERE id=1)']){await f.db.query(q);await f.db.query(q);assert.equal(f.calls.filter(v=>v===q).length,2);}await f.db.query(select,[1]);await f.db.query(select,[2]);await f.db.query('SET timezone TO \'UTC\'');await f.db.query(select,[1]);assert.equal(f.calls.filter(q=>q===select).length,3);await f.db.exec('ROLLBACK');});
});
test('snapshot metadata reuse stays bounded and skips large results',async()=>{
  const f=fixture();f.source.name='x'.repeat(70000);await f.db.withSession(async()=>{await f.db.exec('BEGIN');await f.db.query(select,[1]);await f.db.query(select,[1]);assert.equal(f.calls.filter(q=>q===select).length,2);f.source.name='Small';for(let i=1;i<=140;i++)await f.db.query(select,[i]);const before=f.calls.length;await f.db.query(select,[140]);assert.equal(f.calls.length,before+1);assert.ok(f.db.storage.getStore().readCache.size<=128);await f.db.exec('ROLLBACK');});
});
