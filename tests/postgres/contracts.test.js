import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {postgresFixture} from '../postgres-fixture.js';
import {openPostgres} from '../../src/postgres-db.js';
import {ERP} from '../../.cache/postgres-runtime/src/service.js';
import {migratePostgres} from '../../src/postgres-migrations.js';
import {postgresOptions} from '../../src/postgres-db.js';

test('PostgreSQL read snapshots reuse metadata without stale permissions, mutable row sharing or financial changes',async()=>{
  const f=await postgresFixture(),config=JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')),other=await openPostgres(null,{env:f.environment(config.application)});
  const sql='SELECT name FROM users WHERE id=$1',roles='SELECT role FROM hr_roles WHERE user_id=$1 AND role=$2',id=f.demo.users.outsider;
  let queries=0;const connect=f.db.pool.connect.bind(f.db.pool),wrapped=new WeakSet();f.db.pool.connect=async()=>{const c=await connect();if(!wrapped.has(c)){wrapped.add(c);const query=c.query.bind(c);c.query=(q,...args)=>{if(q===sql)queries++;return query(q,...args);};}return c;};
  try{
    const before=await f.erp.metrics(f.demo.project),old=(await f.db.query(sql,[id])).rows[0].name;
    queries=0;await f.db.withSession(async()=>{await f.db.exec('BEGIN');try{
      const first=await f.db.query(sql,[id]);first.rows[0].name='Caller mutation';assert.equal((await f.db.query(sql,[id])).rows[0].name,old);assert.equal(queries,1);
      assert.equal((await f.db.query(roles,[id,'supervisor'])).rows.length,0);
      await other.query('UPDATE users SET name=$1 WHERE id=$2',['New request identity',id]);await other.query("INSERT INTO hr_roles(user_id,role) VALUES($1,'supervisor') ON CONFLICT DO NOTHING",[id]);
      assert.equal((await f.db.query(sql,[id])).rows[0].name,old);assert.equal((await f.db.query(roles,[id,'supervisor'])).rows.length,0);
      await f.db.exec('COMMIT');
    }catch(e){await f.db.exec('ROLLBACK');throw e;}});
    assert.equal((await f.db.query(sql,[id])).rows[0].name,'New request identity');assert.equal((await f.db.query(roles,[id,'supervisor'])).rows.length,1);
    await other.query("DELETE FROM hr_roles WHERE user_id=$1 AND role='supervisor'",[id]);assert.equal((await f.db.query(roles,[id,'supervisor'])).rows.length,0);
    assert.deepEqual(await f.erp.metrics(f.demo.project),before);assert.equal(before.actual,600000);assert.equal(before.commitment,400000);assert.equal(before.cash,3600000);
  }finally{await other.close();await f.cleanup();}
});

test('PostgreSQL separate connections serialize budgets, partial payments and idempotent receipt retries',async()=>{
  const f=await postgresFixture(),other=await openPostgres(null,{env:f.environment(JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')).application)}),e=new ERP(other);
  try{
    const a=await f.spending('25000.00'),b=await f.spending('25000.00');
    const approvals=await Promise.allSettled([f.op('manager','request.approve',{id:a}),e.execute(f.demo.users.manager,'request.approve',{id:b},randomUUID())]);
    assert.equal(approvals.filter(r=>r.status==='fulfilled').length,1);assert.match(approvals.find(r=>r.status==='rejected').reason.message,/budget/i);
    const m=await f.erp.metrics(f.demo.project);assert.equal(m.commitment,2900000);assert.equal(m.remaining,1500000);
    const pays=await Promise.allSettled([f.op('finance','payment.post',{bill_id:f.demo.bill,account_id:1,amount:'1500.00',date:'2026-04-01',reference:randomUUID()}),e.execute(f.demo.users.finance,'payment.post',{bill_id:f.demo.bill,account_id:1,amount:'1500.00',date:'2026-04-01',reference:randomUUID()},randomUUID())]);assert.equal(pays.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.erp.metrics(f.demo.project)).liability,50000);
    const data={source_id:f.demo.source,account_id:1,amount:'10.00',reference:'PG-DUPLICATE-RECEIPT',date:'2026-04-02'},key=randomUUID();
    const results=await Promise.all([f.erp.execute(f.demo.users.finance,'funding.receive',data,key),e.execute(f.demo.users.finance,'funding.receive',data,key)]);assert.deepEqual(results[0],results[1]);assert.equal((await f.erp.get('SELECT COUNT(*) AS n FROM operations WHERE user_id=? AND key=?',f.demo.users.finance,key)).n,1);assert.equal((await f.erp.get('SELECT COUNT(*) AS n FROM journals WHERE reference=?',data.reference)).n,1);
  }finally{await other.close();await f.cleanup();}
});

test('PostgreSQL backend role cannot alter guards, truncate, mutate posted/audit/receipt evidence or bypass balanced posting',async()=>{
  const f=await postgresFixture();try{
    await assert.rejects(()=>f.db.query('TRUNCATE journal_lines'),/permission denied/);
    await assert.rejects(()=>f.db.query('CREATE TABLE unauthorized(id bigint)'),/permission denied/);
    await assert.rejects(()=>f.erp.run('UPDATE audit SET details=?','{}'),/Immutable/);
    await assert.rejects(()=>f.erp.run('DELETE FROM operations'),/Immutable/);
    await assert.rejects(()=>f.erp.run('UPDATE journal_lines SET amount=amount+1 WHERE id=?',1),/immutable/i);
    await assert.rejects(()=>f.erp.insert('journals',{kind:'test',reference:randomUUID(),date:'2026-04-01',description:'Invalid posted insert',actor_id:f.demo.users.finance,state:'posted'}),/draft/);
    await f.db.withSession(async()=>{await f.db.exec('BEGIN IMMEDIATE');try{const journal=await f.erp.insert('journals',{kind:'test',reference:randomUUID(),date:'2026-04-01',description:'Unbalanced guard',actor_id:f.demo.users.finance});await f.erp.insert('journal_lines',{journal_id:journal,account_id:1,project_id:f.demo.project,source_id:f.demo.source,amount:100});await assert.rejects(()=>f.erp.run("UPDATE journals SET state='posted' WHERE id=?",journal),/balance/);}finally{await f.db.exec('ROLLBACK');}});
    const guards=(await f.owner.query('SELECT COUNT(*) AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal',[f.schema])).rows[0].n;assert.equal(guards,500);
    const tables=(await f.owner.query("SELECT COUNT(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND relkind='r' AND relname NOT IN('pg_migrations','pg_record_key') AND relrowsecurity AND relforcerowsecurity",[f.schema])).rows[0].n;assert.equal(tables,276);
    await f.owner.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='erp_untrusted_test') THEN CREATE ROLE erp_untrusted_test NOLOGIN; END IF; END $$");
    assert.equal((await f.owner.query("SELECT has_schema_privilege('erp_untrusted_test',$1,'USAGE') AS allowed",[f.schema])).rows[0].allowed,false);
    await assert.rejects(()=>openPostgres(null,{env:f.environment(JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')).owner)}),/constrained backend/);
    await assert.rejects(()=>f.erp.orgReport(f.demo.users.requester,{to:'2026-12-31'}),/permission/i);
  }finally{await f.cleanup();}
});

test('PostgreSQL interrupted connection rolls back a published journal and releases financial writer lock',async()=>{
  const f=await postgresFixture();const config=JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')),other=await openPostgres(null,{env:f.environment(config.application)}),e=new ERP(other),ref='PG-INTERRUPTED-'+randomUUID(),before=await f.erp.metrics(f.demo.project);
  try{
    await assert.rejects(()=>other.withSession(async()=>{await other.exec('BEGIN IMMEDIATE');const pid=(await other.query('SELECT pg_backend_pid() AS id')).rows[0].id,j=await e.insert('journals',{kind:'test',reference:ref,date:'2026-04-01',description:'Interrupted synthetic transaction',actor_id:f.demo.users.finance});for(const [account_id,amount]of [[1,100],[7,-100]])await e.insert('journal_lines',{journal_id:j,account_id,project_id:f.demo.project,source_id:f.demo.source,amount});await e.run("UPDATE journals SET state='posted' WHERE id=?",j);await f.owner.query('SELECT pg_terminate_backend($1)',[pid]);await other.exec('COMMIT');}));
    assert.equal(await f.erp.get('SELECT id FROM journals WHERE reference=?',ref),undefined);assert.deepEqual(await f.erp.metrics(f.demo.project),before);
    const data={source_id:f.demo.source,account_id:1,amount:'1.00',reference:ref,date:'2026-04-02'},key=randomUUID();const a=await f.erp.execute(f.demo.users.finance,'funding.receive',data,key),b=await f.erp.execute(f.demo.users.finance,'funding.receive',data,key);assert.deepEqual(a,b);assert.equal((await f.erp.metrics(f.demo.project)).cash,before.cash+100);
  }finally{await other.close();await f.cleanup();}
});

test('PostgreSQL concurrent partial collections consume one receivable without recognizing income twice',async()=>{
  const {organizationFixture}=await import('../../.cache/postgres-runtime/tests/organization-helpers.js'),f=await organizationFixture(),config=JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')),other=await openPostgres(null,{env:f.environment(config.application)}),e=new ERP(other);
  try{const receivable=await f.post('receivable',{party:'Synthetic receivable',external_reference:'PG-CONCURRENT-COLLECTION',due_date:'2026-04-30',documents:[{filename:'entitlement.txt',mime:'text/plain',content:Buffer.from('Synthetic enforceable entitlement').toString('base64')}]}),item=(await f.erp.get('SELECT id FROM org_items WHERE document_id=?',receivable.id)).id,ids=[];
    for(let i=0;i<2;i++){const d=await f.doc('collection',{item_id:item,account_id:1,amount:'700.00'});await f.op('manager','acc.document.approve',{id:d.id});ids.push(d.id);}
    const before=(await f.erp.orgReport(f.demo.users.finance,{scope:'general',to:'2026-12-31'})).totals;
    const results=await Promise.allSettled([f.op('finance','acc.document.post',{id:ids[0]}),e.execute(f.demo.users.finance,'acc.document.post',{id:ids[1]},randomUUID())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await f.erp.orgItemOutstanding(item),30000);
    const after=(await f.erp.orgReport(f.demo.users.finance,{scope:'general',to:'2026-12-31'})).totals;assert.equal(after.income,before.income);assert.equal(after.expenses,before.expenses);assert.equal(Number(after.closing_cash)-Number(before.closing_cash),700);
    const {backgroundJobs}=await import('../../.cache/postgres-runtime/src/jobs.js'),jobs=backgroundJobs(f.erp,{enabled:true,actor:f.demo.users.admin,transportsEnabled:false});try{assert.equal((await jobs.runNow()).ok,true);}finally{await jobs.stop();}
  }finally{await other.close();await f.cleanup();}
});

test('PostgreSQL upgrades preserve balances, reruns are stable, checksum drift and unsafe configuration fail closed',async()=>{
  const config=JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')),schema='test_'+randomUUID().replaceAll('-',''),env={ERP_POSTGRES_URL:config.owner,ERP_MASTER_KEY_FILE:config.key_file,ERP_POSTGRES_SCHEMA:schema},db=await openPostgres(null,{env,owner:true});
  try{assert.equal((await migratePostgres(db,{through:'002_private_access.sql'})).length,2);await assert.rejects(()=>openPostgres(null,{env:{...env,ERP_POSTGRES_URL:config.application}}),/incomplete/);
    const {seedDemo}=await import('../../.cache/postgres-runtime/src/demo.js'),demo=await seedDemo(db),e=new ERP(db),before=await e.metrics(demo.project);assert.equal((await migratePostgres(db)).length,4);assert.deepEqual(await e.metrics(demo.project),before);const first=(await db.query('SELECT * FROM pg_migrations ORDER BY name')).rows;await migratePostgres(db);assert.deepEqual((await db.query('SELECT * FROM pg_migrations ORDER BY name')).rows,first);
    await db.query("UPDATE pg_migrations SET sha256='wrong' WHERE name='001_schema13.sql'");await assert.rejects(()=>migratePostgres(db),/checksum changed/);
    assert.throws(()=>postgresOptions({ERP_POSTGRES_URL:'postgresql://user@staging.example.invalid/db'}),/verified TLS/);assert.throws(()=>postgresOptions({}),/fallback is prohibited/);assert.throws(()=>postgresOptions({ERP_POSTGRES_URL:'postgresql://user@staging.example.invalid/db?sslmode=no-verify',ERP_POSTGRES_TLS:'true'}),/URL overrides/);
  }finally{await db.query('DROP SCHEMA "'+schema+'" CASCADE');await db.close();}
});

test('PostgreSQL administrator bootstrap holds one transaction and rolls back a failed private enrollment',async()=>{
  const config=JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8')),schema='test_'+randomUUID().replaceAll('-',''),env={ERP_POSTGRES_URL:config.owner,ERP_MASTER_KEY_FILE:config.key_file,ERP_POSTGRES_SCHEMA:schema},owner=await openPostgres(null,{env,owner:true});let app;
  try{await migratePostgres(owner);app=await openPostgres(null,{env:{...env,ERP_POSTGRES_URL:config.application}});const e=new ERP(app),{bootstrapAdministrator}=await import('../../.cache/postgres-runtime/src/bootstrap.js');
    await assert.rejects(()=>bootstrapAdministrator(e,{email:'synthetic-admin@example.invalid',password:randomUUID(),mfaFile:'.cache/missing-'+randomUUID()+'/private-enrollment.json'}),/ENOENT/);assert.equal((await e.get('SELECT COUNT(*) AS n FROM users')).n,0);assert.equal((await e.get('SELECT COUNT(*) AS n FROM mfa_recovery')).n,0);
    const result=await bootstrapAdministrator(e,{email:'synthetic-admin@example.invalid',password:randomUUID()});assert.ok(result.id);assert.equal((await e.get('SELECT COUNT(*) AS n FROM audit')).n,1);
    await assert.rejects(()=>openPostgres(null,{env:{...env,ERP_POSTGRES_URL:config.application,ERP_MASTER_KEY_FILE:undefined,ERP_MASTER_KEY:'ab'.repeat(32)}}),/record key does not match/);
  }finally{await app?.close();await owner.query('DROP SCHEMA "'+schema+'" CASCADE');await owner.close();}
});
