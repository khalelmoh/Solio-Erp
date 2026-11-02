import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {openDatabase} from '../src/db.js';
import {seedPeople} from '../src/people-demo.js';
import {createApp} from '../src/server.js';

// This command intentionally ignores ERP_DB and never loads the saved .env.
process.env.ERP_JOBS_ENABLED='false';process.env.ERP_TRANSPORTS_ENABLED='false';
const id=randomUUID(),path=resolve('data','uat-'+id+'.sqlite');mkdirSync(resolve('data'),{recursive:true});
const db=openDatabase(path);let server;
try{
  seedPeople(db);
  db.prepare("UPDATE release_environment SET quarantined=1,reason='Isolated synthetic human UAT; no external services or automatic erasure' WHERE id=1").run();
  server=createApp(db,{jobs:{enabled:false},publicOrigin:'http://127.0.0.1:3003',proxySecret:''});
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3003,'127.0.0.1',ok);});
  mkdirSync('artifacts/uat/sessions',{recursive:true});
  writeFileSync('artifacts/uat/sessions/'+id+'.json',JSON.stringify({id,started_at:new Date().toISOString(),database:path,url:'http://127.0.0.1:3003',synthetic:true,quarantined:true,human_acceptance:'pending'},null,2),{flag:'wx'});
  console.log('Synthetic human UAT: http://127.0.0.1:3003\nSeparate database: '+path+'\nExternal services/jobs/automatic erasure disabled by persistent quarantine.\nUse demo sign-in for synthetic Admin, Manager, Finance and Requester accounts only.\nDo not enter real employee data or payment details. Leave this process running during review.');
}catch(error){if(server)server.close();db.close();throw error;}
let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await server.jobs.stop();server.close(()=>{db.close();process.exit(0);});};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
