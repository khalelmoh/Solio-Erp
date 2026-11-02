import {createHash} from 'node:crypto';
import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFileSync,readdirSync} from 'node:fs';
const {Pool,types}=pg;
for(const oid of [20,1700])types.setTypeParser(oid,s=>{const n=Number(s);if(!Number.isSafeInteger(n))throw Error('Database integer exceeds safe USD precision');return n;});
export function postgresOptions(env=process.env){
  const connectionString=env.ERP_POSTGRES_URL_FILE?readFileSync(env.ERP_POSTGRES_URL_FILE,'utf8').trim():env.ERP_POSTGRES_URL;
  if(!connectionString)throw Error('PostgreSQL selected: ERP_POSTGRES_URL_FILE is required; SQLite fallback is prohibited');
  const url=new URL(connectionString);if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('Invalid PostgreSQL connection protocol');
  const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(!local&&env.ERP_POSTGRES_TLS!=='true')throw Error('Remote PostgreSQL requires verified TLS: ERP_POSTGRES_TLS=true');
  if([...url.searchParams.keys()].some(k=>k.startsWith('ssl')))throw Error('Configure verified TLS through ERP_POSTGRES_TLS/CA_FILE, not URL overrides');
  if(url.port==='6543'||!local&&!['direct','session'].includes(env.ERP_POSTGRES_CONNECTION_MODE))throw Error('Use a direct or session-mode PostgreSQL connection; transaction-mode pooling is unsupported');
  const schema=env.ERP_POSTGRES_SCHEMA||'erp_private';if(!/^[a-z][a-z0-9_]{0,40}$/.test(schema))throw Error('Invalid PostgreSQL private schema');
  if(['public','auth','storage','extensions'].includes(schema))throw Error('Use a dedicated private ERP schema');
  return{connectionString,schema,ssl:local&&env.ERP_POSTGRES_TLS!=='true'?false:{rejectUnauthorized:true,...(env.ERP_POSTGRES_CA_FILE?{ca:readFileSync(env.ERP_POSTGRES_CA_FILE,'utf8')}:{})},max:10,connectionTimeoutMillis:10000,application_name:'folio-erp'};
}
export function sqlForPostgres(sql,args=[]){
  if(/^PRAGMA integrity_check$/i.test(sql.trim()))return "SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM journals j WHERE state='posted' AND ((SELECT COUNT(*) FROM journal_lines WHERE journal_id=j.id)<2 OR COALESCE((SELECT SUM(amount) FROM journal_lines WHERE journal_id=j.id),1)<>0)) AND NOT EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=current_schema() AND NOT c.convalidated) THEN 'ok' ELSE 'failed' END AS integrity_check";
  if(/^PRAGMA foreign_key_check$/i.test(sql.trim()))return "SELECT conname AS constraint_name FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=current_schema() AND contype='f' AND NOT convalidated";
  let index=0,quote=false,out='';
  for(let i=0;i<sql.length;i++){const c=sql[i];if(c==="'"){out+=c;if(quote&&sql[i+1]==="'"){out+=sql[++i];continue;}quote=!quote;continue;}if(c==='?'&&!quote){const n=index++;out+='$'+(n+1)+(typeof args[n]==='number'?'::bigint':/^\s+IS\s+(?:NOT\s+)?NULL/i.test(sql.slice(i+1))?'::text':'');}else out+=c;}
  const ignore=/\bINSERT OR IGNORE\b/i.test(out);out=out.replace(/\bINSERT OR IGNORE\b/ig,'INSERT');if(ignore)out+=' ON CONFLICT DO NOTHING';
  out=out.replace(/json_extract\(([^,]+),\s*'\$\.([a-z_]+)'\)/gi,"(($1)::jsonb->>'$2')::bigint");
  out=out.replace(/SET attempts=attempts\+1/i,'SET attempts=auth_limits.attempts+1');
  if(/\bINSERT OR REPLACE|\bPRAGMA|sqlite_master|\bGLOB\b/i.test(out))throw Error('Unported SQLite SQL rejected by PostgreSQL adapter');
  return out;
}
export class PostgresDatabase {
  constructor(pool,{schema,key,owner=false}){this.pool=pool;this.schema=schema;this.erpMasterKey=key;this.erpPath=null;this.storage=new AsyncLocalStorage();this.owner=owner;this.provider='postgres';this.identities=new Set();pool.on('error',()=>{this.lastConnectionFailure=Date.now();});}
  get isTransaction(){return!!this.storage.getStore()?.transaction;}
  async withSession(fn){if(this.storage.getStore())return fn();const client=await this.pool.connect();const state={client,transaction:false};let connectionError;const failed=e=>{connectionError=e;};client.on('error',failed);try{await client.query('SET search_path TO "'+this.schema+'", pg_catalog');await client.query("SET timezone TO 'UTC'");return await this.storage.run(state,fn);}finally{if(state.transaction)await client.query('ROLLBACK').catch(e=>{connectionError=e;});client.removeListener('error',failed);client.release(connectionError);}}
  async query(sql,args=[]){return this.withSession(async()=>{try{return await this.storage.getStore().client.query(sql,args);}catch(e){const messages={'23505':'UNIQUE constraint: duplicate reference or document','23503':'FOREIGN KEY constraint: invalid linked record','23514':'CHECK constraint: invalid record'};if(messages[e.code]){e.message=e.code==='23514'&&!e.constraint?'CHECK constraint: '+e.message:messages[e.code];}throw e;}});}
  prepare(sql){return{get:async(...args)=>(await this.query(sqlForPostgres(sql,args),args)).rows[0],all:async(...args)=>(await this.query(sqlForPostgres(sql,args),args)).rows,run:async(...args)=>{let q=sqlForPostgres(sql,args);const table=/^\s*INSERT\s+INTO\s+"?([a-z_]+)/i.exec(q)?.[1];if(table&&this.identities.has(table)&&!bReturning(q))q+=' RETURNING id';const result=await this.query(q,args);return{changes:result.rowCount,lastInsertRowid:result.rows[0]?.id||0};}};}
  async exec(sql){return this.withSession(async()=>{const state=this.storage.getStore();if(/^BEGIN(?: IMMEDIATE)?$/i.test(sql.trim())){if(state.transaction)throw Error('Nested PostgreSQL transaction');await state.client.query(/^BEGIN IMMEDIATE$/i.test(sql.trim())?'BEGIN ISOLATION LEVEL READ COMMITTED':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');state.transaction=true;if(/IMMEDIATE/i.test(sql))await state.client.query('SELECT pg_advisory_xact_lock(183660734, 1)');return;}if(/^(COMMIT|ROLLBACK)$/i.test(sql.trim())){try{return await state.client.query(sql);}finally{state.transaction=false;}}return this.query(sql);});}
  async close(){await this.pool.end();}
}
function bReturning(q){return/\bRETURNING\b/i.test(q);}
export async function openPostgres(_unused,{env=process.env,owner=false}={}){
  const options=postgresOptions(env),keyText=env.ERP_MASTER_KEY_FILE?readFileSync(env.ERP_MASTER_KEY_FILE,'utf8').trim():env.ERP_MASTER_KEY;
  if(!/^[a-f\d]{64}$/i.test(keyText||''))throw Error('PostgreSQL requires its external 32-byte record key before opening');
  const db=new PostgresDatabase(new Pool(options),{...options,key:Buffer.from(keyText,'hex'),owner});
  try{
    await db.query('SELECT 1');
    const lockCapacity=Number((await db.query('SHOW max_locks_per_transaction')).rows[0].max_locks_per_transaction);
    if(lockCapacity<512)throw Error('PostgreSQL max_locks_per_transaction must be at least 512 for the verified ERP migration/recovery profile; configure and restart PostgreSQL before use');
    if(!owner){
      const role=(await db.query("SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,has_schema_privilege(current_user,$1,'CREATE') AS schema_create FROM pg_roles WHERE rolname=current_user",[db.schema])).rows[0];
      if(role.rolsuper||role.rolbypassrls||role.rolcreaterole||role.rolcreatedb||role.rolreplication||role.schema_create)throw Error('API PostgreSQL login must be a constrained backend role, without ownership, CREATE or RLS bypass');
      if((await db.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' AND c.relname NOT IN('pg_migrations','pg_record_key') AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity) LIMIT 1",[db.schema])).rows.length)throw Error('ERP PostgreSQL tables require forced row-level security');
      const applied=(await db.query('SELECT name,sha256 FROM pg_migrations')).rows;
      if(!applied.some(m=>m.name==='004_record_key.sql'))throw Error('PostgreSQL migrations are incomplete; use the separate migrator credentials');
      const migrations=readdirSync(new URL('../migrations/postgres/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort();
      if(applied.length!==migrations.length||migrations.some(name=>applied.find(a=>a.name===name)?.sha256!==createHash('sha256').update(readFileSync(new URL('../migrations/postgres/'+name,import.meta.url))).digest('hex')))throw Error('PostgreSQL schema version/checksum mismatch; verify release migrations');
    }
    if(!owner){const expected=createHash('sha256').update(db.erpMasterKey).digest('hex');if((await db.query('SELECT sha256 FROM pg_record_key WHERE id=true')).rows[0]?.sha256!==expected)throw Error('PostgreSQL record key does not match this database');}
    const tables=await db.query("SELECT table_name FROM information_schema.columns WHERE table_schema=$1 AND column_name='id' AND is_identity='YES'",[db.schema]);db.identities=new Set(tables.rows.map(r=>r.table_name));return db;
  }catch(e){await db.close();throw e;}
}
