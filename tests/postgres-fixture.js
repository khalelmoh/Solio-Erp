import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openPostgres} from '../src/postgres-db.js';
import {migratePostgres} from '../src/postgres-migrations.js';
export const postgresTestConfig=()=>JSON.parse(readFileSync('.cache/postgres/test.env.json','utf8'));
export async function postgresFixture(kind='project'){
  const config=postgresTestConfig(),schema='test_'+randomUUID().replaceAll('-',''),environment=url=>({ERP_POSTGRES_URL:url,ERP_MASTER_KEY_FILE:config.key_file,ERP_POSTGRES_SCHEMA:schema});
  const owner=await openPostgres(null,{env:environment(config.owner),owner:true});await migratePostgres(owner);
  const db=await openPostgres(null,{env:environment(config.application)}),module=pathToFileURL(resolve('.cache/postgres-runtime/src/'+(kind==='accounting'?'accounting-demo.js':'demo.js'))).href;
  const seed=await import(module),demo=await(kind==='accounting'?seed.seedAccountingDemo(db):seed.seedDemo(db)),{ERP}=await import(pathToFileURL(resolve('.cache/postgres-runtime/src/service.js')).href),erp=new ERP(db);
  const op=(role,action,data,key=randomUUID())=>erp.execute(demo.users[role],action,data,key),spending=(amount='1000.00',extra={})=>op('requester','request.submit',{title:'PostgreSQL synthetic request',date:'2026-03-01',lines:[{project_id:demo.project,source_id:demo.source,category:'Equipment',activity:'Outreach',amount}],...extra}).then(r=>r.id);
  return{db,erp,demo,op,spending,path:schema,schema,owner,environment,async cleanup(){await db.close();if(!/^test_[a-f0-9]{32}$/.test(schema))throw Error('Unsafe PostgreSQL fixture cleanup');await owner.query('DROP SCHEMA "'+schema+'" CASCADE');await owner.close();}};
}
