import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {openDatabase,defaultPath} from '../src/db.js';
import {createApp} from '../src/server.js';
// Deliberately local synthetic SQLite, irrespective of a future remote deployment environment.
// Do not invoke with --env-file=.env; no saved database or live provider credentials are used.
const completed=JSON.parse(readFileSync('artifacts/uat/guided-project-finance-session.json','utf8')),path=realpathSync(completed.database);
if(dirname(path)!==realpathSync('data')||!/^uat-[a-f0-9-]+\.sqlite$/.test(basename(path))||path===realpathSync(defaultPath)||!existsSync(path+'.key'))throw Error('Use the recorded separate synthetic database and its existing key');
const check=new DatabaseSync(path,{readOnly:true});try{if(check.prepare('SELECT quarantined FROM release_environment WHERE id=1').get()?.quarantined!==1||check.prepare('SELECT code FROM projects WHERE id=?').get(completed.project_id)?.code!==completed.planned_project_code)throw Error('Synthetic quarantine/project evidence is missing');}finally{check.close();}
process.env.ERP_DATABASE_PROVIDER='sqlite';process.env.NODE_ENV='development';process.env.ERP_STAGING_SYNTHETIC_ONLY='true';process.env.ERP_JOBS_ENABLED='false';process.env.ERP_TRANSPORTS_ENABLED='false';delete process.env.ERP_MASTER_KEY;process.env.ERP_MASTER_KEY_FILE=path+'.key';
const db=openDatabase(path),server=createApp(db,{jobs:{enabled:false,transportsEnabled:false},publicOrigin:'http://127.0.0.1:3003',proxySecret:''});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3003,'127.0.0.1',ok);});
const record={started_at:new Date().toISOString(),url:'http://127.0.0.1:3003',pid:process.pid,database:path,synthetic:true,quarantined:true,jobs_enabled:false,transports_enabled:false,completed_scenario_evidence:completed.scenario_result,next_scenario:'Advance settlement and unused-money return',human_acceptance:'pending_actual_findings'};
writeFileSync('artifacts/uat/stage7-session.json',JSON.stringify(record,null,2));console.log(JSON.stringify({url:record.url,pid:record.pid,synthetic:true,quarantined:true}));
let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await server.jobs.stop();server.close(()=>{db.close();process.exit(0);});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
