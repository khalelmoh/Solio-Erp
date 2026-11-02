import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openPostgres} from './postgres-db.js';
import {runtimeConfig} from './runtime.js';
export async function postgresRuntime(){
  const root=resolve('.cache/postgres-runtime'),manifest=JSON.parse(readFileSync(root+'/source-manifest.json','utf8'));
  for(const source of manifest.source){if(createHash('sha256').update(readFileSync(source.path)).digest('hex')!==source.sha256)throw Error('PostgreSQL runtime is stale; run npm run build:postgres before starting');}
  return{ERP:(await import(pathToFileURL(root+'/src/service.js').href)).ERP,createApp:(await import(pathToFileURL(root+'/src/server.js').href)).createApp,root};
}
export async function startPostgres(){
  const config=runtimeConfig(),runtime=await postgresRuntime(),db=await openPostgres();
  try{
    const server=await runtime.createApp(db,{secureCookies:config.secureCookies,jobs:config.jobs,sessionCookie:process.env.ERP_SESSION_COOKIE||'erp_postgres_session'});
    await new Promise((accept,reject)=>{server.once('error',reject);server.listen(config.port,config.host,accept);});
    console.log(JSON.stringify({event:'api.started',provider:'postgres',host:config.host,port:config.port,synthetic:process.env.ERP_STAGING_SYNTHETIC_ONLY==='true'}));
    let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await server.jobs.stop();server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();};process.once('SIGINT',stop);process.once('SIGTERM',stop);return{server,db,stop};
  }catch(e){await db.close();throw e;}
}
