import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fixture} from '../tests/helpers.js';
import {createApp} from '../src/server.js';
const mode=process.argv[2]||'after';if(!['baseline','after'].includes(mode))throw Error('Choose baseline or after');
const workload={projects:60,receipts:600,requests:40,concurrency:5,page_size:20},f=fixture(),server=createApp(f.db),dimensions=[{id:f.demo.project,source:f.demo.source}];
try{
  for(let i=0;i<workload.projects-2;i++){
    const id=f.op('manager','project.create',{code:'S7-P-'+String(i).padStart(3,'0'),name:'Stage 7 synthetic project '+i,description:'Isolated repeatable project-list workload',department:'UAT',start_date:'2026-01-01',end_date:'2026-12-31',activities:['General'],demo:true}).id;
    f.op('admin','membership.set',{project_id:id,user_id:f.demo.users.finance,role:'finance'});
    const b=f.op('manager','budget.submit',{project_id:id,reason:'Synthetic workload',lines:[{category:'Equipment',activity:'General',start_date:'2026-01-01',end_date:'2026-12-31',amount:'50000.00'}]}).id;f.op('finance','budget.approve',{id:b});
    const source=f.op('manager','source.create',{project_id:id,name:'Synthetic funding',type:'organization',categories:['Equipment'],start_date:'2026-01-01',end_date:'2026-12-31'}).id;dimensions.push({id,source});
  }
  for(let i=0;i<workload.receipts;i++){const p=dimensions[i%dimensions.length];f.op('finance','funding.receive',{source_id:p.source,account_id:1,amount:'10.00',date:'2026-10-01',reference:'S7-LOAD-'+i});}
  const prepare=f.db.prepare.bind(f.db);let statements=0;f.db.prepare=(...args)=>{statements++;return prepare(...args);};
  const start=performance.now(),projects=f.erp.listProjects(f.demo.users.finance),serviceMs=performance.now()-start,serviceStatements=statements;f.db.prepare=prepare;
  for(const p of projects){const m=f.erp.metrics(p.id);for(const key of Object.keys(p.metrics))assert.equal(p.metrics[key],(m[key]/100).toFixed(2));}
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'finance@demo.erp',password:'Demo-only-2026!'})}),cookie=login.headers.get('set-cookie').split(';')[0];
  statements=0;f.db.prepare=(...args)=>{statements++;return prepare(...args);};const first=await fetch(origin+'/api/projects?page=1&page_size=20',{headers:{Cookie:cookie}}),firstBody=await first.text(),httpStatements=statements;f.db.prepare=prepare;assert.equal(first.status,200);const body=JSON.parse(firstBody);
  const samples=[];for(let n=0;n<workload.requests;n+=workload.concurrency)await Promise.all(Array.from({length:workload.concurrency},async()=>{const t=performance.now(),res=await fetch(origin+'/api/projects?page=1&page_size=20',{headers:{Cookie:cookie}});assert.equal(res.status,200);await res.arrayBuffer();samples.push(performance.now()-t);}));samples.sort((a,b)=>a-b);
  const result={mode,node:process.version,captured_at:new Date().toISOString(),workload,service:{sql_statements:serviceStatements,ms:serviceMs,returned_projects:projects.length},http:{sql_statements_including_auth:httpStatements,payload_bytes:Buffer.byteLength(firstBody),returned_projects:body.projects.length,pagination:body.pagination||null,p50_ms:samples[Math.floor(samples.length*.5)],p95_ms:samples[Math.floor(samples.length*.95)]},accuracy:'Every returned project metric agrees with its independent existing dashboard calculation',limits:'Local Windows single-process synthetic measurements; not target-host capacity or production throughput'};
  if(mode==='after'){assert.ok(body.projects.length<=20);assert.ok(serviceStatements<=8);assert.equal(body.pagination.total,workload.projects);}
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/stage7-project-'+mode+'.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
}finally{server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));f.cleanup();}
