import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';
import { createApp } from '../src/server.js';
import { DEMO_PASSWORD } from '../src/demo.js';

test('authenticated HTTP workflow from new project through partial billing/payment and drill-down',async()=>{
  const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`,cookies={};
  async function request(role,path,method='GET',payload,extra={}) {
    const response=await fetch(base+path,{method,headers:{...(cookies[role]?{Cookie:cookies[role]}:{}),...(payload?{'Content-Type':'application/json'}:{}),...extra},body:payload?JSON.stringify(payload):undefined});
    if(response.headers.get('set-cookie'))cookies[role]=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  async function op(role,action,data,key=randomUUID()) { const r=await request(role,'/api/actions','POST',{action,data},{'Idempotency-Key':key});assert.equal(r.status,200,JSON.stringify(r.body));return r.body; }
  try {
    assert.equal((await request('nobody','/api/projects')).status,401);
    const asset=await fetch(base+'/');assert.equal(asset.status,200);assert.match(await asset.text(),/Folio/);assert.match(asset.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    for(const role of ['admin','manager','finance','requester','outsider']) {
      const login=await request(role,'/api/login','POST',{email:`${role}@demo.erp`,password:DEMO_PASSWORD});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    }
    assert.equal((await request('manager','/api/actions','POST',{action:'project.create',data:{}},{Origin:'https://evil.invalid','Idempotency-Key':randomUUID()})).status,403);
    assert.equal((await request('outsider',`/api/projects/${f.demo.project}`)).status,403);
    const p=(await op('manager','project.create',{code:'HTTP-TEST',name:'Browser workflow test',description:'New project created through authenticated API',department:'Programs',start_date:'2026-01-01',end_date:'2026-12-31',activities:['General']})).id;
    for(const role of ['finance','requester'])await op('admin','membership.set',{project_id:p,user_id:f.demo.users[role],role});
    const budget=(await op('manager','budget.submit',{project_id:p,reason:'Original HTTP budget',lines:[{category:'Operations',activity:'General',start_date:'2026-01-01',end_date:'2026-12-31',amount:'50000.00'}]})).id;
    assert.equal((await request('manager','/api/actions','POST',{action:'budget.approve',data:{id:budget}},{'Idempotency-Key':randomUUID()})).status,403);
    await op('finance','budget.approve',{id:budget});
    const source=(await op('manager','source.create',{project_id:p,name:'HTTP donor',type:'donor',categories:['Operations'],start_date:'2026-01-01',end_date:'2026-12-31'})).id;
    await op('finance','funding.receive',{source_id:source,account_id:1,date:'2026-04-01',reference:'HTTP-RECEIPT',amount:'40000.00'});
    const r=(await op('requester','request.submit',{title:'API procurement',date:'2026-04-02',lines:[{project_id:p,source_id:source,category:'Operations',activity:'General',amount:'10000.00'}]})).id;
    await op('manager','request.approve',{id:r});
    const po=(await op('manager','po.create',{request_id:r,supplier:'HTTP supplier',reference:'HTTP-PO',date:'2026-04-03'})).id;
    let detail=(await request('finance',`/api/projects/${p}`)).body;
    const line=detail.requests.find(x=>x.id===r).lines[0].id;
    const bill=(await op('finance','bill.post',{po_id:po,invoice:'HTTP-INV',date:'2026-04-04',lines:[{request_line_id:line,amount:'6000.00'}]})).id;
    await op('finance','payment.post',{bill_id:bill,account_id:1,reference:'HTTP-PAY',date:'2026-04-05',amount:'4000.00'});
    detail=(await request('manager',`/api/projects/${p}`)).body;
    assert.equal(detail.metrics.actual,'6000.00');assert.equal(detail.metrics.commitment,'4000.00');assert.equal(detail.metrics.remaining,'40000.00');assert.equal(detail.metrics.liability,'2000.00');assert.equal(detail.metrics.cash,'36000.00');
    assert.equal(detail.transactions.length,3);assert.ok(detail.transactions.every(j=>j.lines.length>=2));
    await request('manager','/api/logout','POST');assert.equal((await request('manager','/api/projects')).status,401);
  } finally {await new Promise(r=>server.close(r));f.cleanup();}
});

test('passwords are hashed and excluded from audit; expired sessions fail',()=>{
  const f=fixture();try {
    const secret='Do-not-audit-this-password';
    f.op('admin','user.create',{name:'Security test',email:'new@example.org',password:secret});
    assert.equal(f.erp.all('SELECT details FROM audit').some(a=>a.details.includes(secret)),false);
    const stored=f.erp.get('SELECT * FROM users WHERE email=?','new@example.org');assert.notEqual(stored.password_hash,secret);assert.equal(stored.password_hash.length,128);
    const login=f.erp.login('new@example.org',secret);assert.equal(f.erp.authenticate(login.token),stored.id);
    f.db.prepare('UPDATE sessions SET expires=0').run();assert.throws(()=>f.erp.authenticate(login.token),/expired/);
    assert.throws(()=>f.erp.login('new@example.org','wrong-password'),/Invalid credentials/);
  }finally{f.cleanup();}
});
