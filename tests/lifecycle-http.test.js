import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';
import { createApp } from '../src/server.js';
import { DEMO_PASSWORD } from '../src/demo.js';

test('new HTTP screens/assets, protected supporting files, CSV reports and statement imports',async()=>{
  const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  async function login(role){const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`${role}@demo.erp`,password:DEMO_PASSWORD})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  try{
    const finance=await login('finance'),admin=await login('admin'),outsider=await login('outsider');
    for(const asset of ['/lifecycle-ui.js','/lifecycle.css'])assert.equal((await fetch(base+asset)).status,200);
    const action=await fetch(base+'/api/actions',{method:'POST',headers:{Cookie:finance,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({action:'request.submit',data:{title:'HTTP evidence',date:'2026-03-01',lines:[{project_id:f.demo.project,source_id:f.demo.source,category:'Equipment',activity:'Outreach',amount:'0.29'}],documents:[{filename:'evidence.txt',mime:'text/plain',content:Buffer.from('HTTP receipt').toString('base64')}]}})});assert.equal(action.status,200);
    const request=(await action.json()).id,doc=f.erp.documents('request',request)[0];const download=await fetch(base+`/api/documents/${doc.id}`,{headers:{Cookie:finance}});assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.equal(await download.text(),'HTTP receipt');
    assert.equal((await fetch(base+`/api/documents/${doc.id}`,{headers:{Cookie:outsider}})).status,403);
    const csv=await fetch(base+`/api/projects/${f.demo.project}/report.csv?from=2026-01-01&to=2026-12-31`,{headers:{Cookie:finance}});assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(await csv.text(),/"6000.00"/);
    assert.equal((await fetch(base+`/api/projects/${f.demo.project}/report.csv`,{headers:{Cookie:outsider}})).status,403);
    assert.equal((await fetch(base+'/api/reconciliation',{headers:{Cookie:finance}})).status,403);assert.equal((await fetch(base+'/api/reconciliation',{headers:{Cookie:admin}})).status,200);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));f.cleanup();}
});

test('small fixed-scale balances survive dashboards, CSV and report aggregation without floating arithmetic',()=>{
  const f=fixture();try{
    f.op('admin','membership.set',{project_id:f.demo.overhead,user_id:f.demo.users.requester,role:'requester'});
    const budget=f.op('manager','budget.submit',{project_id:f.demo.overhead,reason:'Exact cents test',lines:[{category:'Admin',activity:'General',start_date:'2026-01-01',end_date:'2026-12-31',amount:'1.00'}]}).id;f.op('finance','budget.approve',{id:budget});
    const source=f.op('manager','source.create',{project_id:f.demo.overhead,name:'Cent source',type:'organization',categories:[],start_date:'2026-01-01',end_date:'2026-12-31'}).id;
    const r=f.op('requester','request.submit',{title:'Exact 29 cent reservation',date:'2026-03-01',lines:[{project_id:f.demo.overhead,source_id:source,category:'Admin',activity:'General',amount:'0.29'}]}).id;f.op('manager','request.approve',{id:r});
    const d=f.erp.dashboard(f.demo.users.manager,f.demo.overhead);assert.equal(d.metrics.other_reservations,'0.29');assert.equal(d.metrics.remaining,'0.71');const report=f.erp.report(f.demo.users.manager,f.demo.overhead,{to:'2026-12-31'});assert.equal(report.totals.available,'0.71');assert.equal(report.totals.commitment,'0.29');
  }finally{f.cleanup();}
});
