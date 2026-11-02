import {existsSync,readFileSync,writeFileSync,realpathSync,mkdirSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
import {createApp} from '../src/server.js';
import {seedOrganizationDemo} from '../src/organization-demo.js';

// Explicitly isolated local synthetic profile; never load .env or saved/UAT DBs.
process.env.NODE_ENV='development';process.env.ERP_DATABASE_PROVIDER='sqlite';process.env.ERP_STAGING_SYNTHETIC_ONLY='true';process.env.ERP_JOBS_ENABLED='false';process.env.ERP_TRANSPORTS_ENABLED='false';delete process.env.ERP_MASTER_KEY;delete process.env.ERP_MASTER_KEY_FILE;
mkdirSync('data',{recursive:true});mkdirSync('artifacts',{recursive:true});
const statePath='artifacts/organization-finance-session.json',resume=process.argv.includes('--resume');
const previous=resume?JSON.parse(readFileSync(statePath,'utf8')):null,path=resume?realpathSync(previous.database):resolve('data','organization-demo-'+randomUUID()+'.sqlite');
if(dirname(path)!==realpathSync('data')||!/^organization-demo-[a-f0-9-]+\.sqlite$/.test(basename(path))||resume&&(!previous.synthetic||!existsSync(path+'.key'))||!resume&&(existsSync(path)||existsSync(path+'.key')))throw Error('A separate synthetic organization database and matching key are required');
const db=openDatabase(path),erp=new ERP(db);let demo;
if(!resume){demo=seedOrganizationDemo(db);db.prepare("UPDATE release_environment SET quarantined=1 WHERE id=1").run();}
if(!erp.quarantined())throw Error('Synthetic quarantine is required');
const server=createApp(db,{jobs:{enabled:false,transportsEnabled:false},publicOrigin:'http://127.0.0.1:3004',proxySecret:'',sessionCookie:'erp_organization_session'});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3004,'127.0.0.1',ok);});
const report=erp.orgReport((demo||previous.demo).users.finance,{scope:'general',from:'2026-01-01',to:'2026-12-31'}),record={started_at:new Date().toISOString(),url:'http://127.0.0.1:3004',pid:process.pid,database:path,synthetic:true,quarantined:true,jobs_enabled:false,transports_enabled:false,version:JSON.parse(readFileSync('package.json','utf8')).version,demo:demo||previous.demo,general_totals:report.totals,human_acceptance:'not performed; automated local demonstration only'};writeFileSync(statePath,JSON.stringify(record,null,2));console.log(JSON.stringify({url:record.url,pid:record.pid,version:record.version,synthetic:true,general_totals:record.general_totals}));
let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await server.jobs.stop();server.close(()=>{db.close();process.exit(0);});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
