import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.js';
import {accountingFixture} from './accounting-helpers.js';
import {createApp} from '../src/server.js';

function agree(f){for(const p of f.erp.projectPage(f.demo.users.finance,{page_size:50}).projects){const expected=f.erp.metrics(p.id);for(const [key,value] of Object.entries(p.metrics))assert.equal(value,(expected[key]/100).toFixed(2),'Project '+p.id+' '+key);}}
function extraProjects(f,n=55){for(let i=0;i<n;i++){const id=f.op('manager','project.create',{code:'PAGE-'+String(i).padStart(3,'0'),name:'Synthetic page project '+i,description:'Pagination fixture',department:'Programs',start_date:'2026-01-01',end_date:'2026-12-31',activities:['General']}).id;f.op('admin','membership.set',{project_id:id,user_id:f.demo.users.finance,role:'finance'});}}

test('project pages bound results, traverse without duplicates, filter literal text and preserve membership scope',()=>{const f=fixture();try{
  extraProjects(f);const page=f.erp.projectPage(f.demo.users.finance);assert.equal(page.projects.length,20);assert.equal(page.pagination.total,57);
  const ids=[1,2,3].flatMap(page=>f.erp.projectPage(f.demo.users.finance,{page}).projects.map(p=>p.id));assert.equal(ids.length,57);assert.equal(new Set(ids).size,57);
  assert.equal(f.erp.projectPage(f.demo.users.finance,{q:'PAGE-05'}).pagination.total,5);assert.equal(f.erp.projectPage(f.demo.users.finance,{q:'%'}).pagination.total,0);
  assert.equal(f.erp.projectPage(f.demo.users.outsider,{q:'PAGE'}).pagination.total,0);assert.equal(f.erp.projectPage(f.demo.users.requester).pagination.total,1);
  assert.equal(f.erp.projectPage(f.demo.users.finance,{page:99}).projects.length,0);
  for(const options of [{page:0},{page:'1 OR 1'},{page_size:51},{page_size:-1},{status:'active OR 1'},{q:'x'.repeat(101)}])assert.throws(()=>f.erp.projectPage(f.demo.users.finance,options));
  const original=f.db.prepare.bind(f.db);let count=0;f.db.prepare=(...args)=>{count++;return original(...args);};try{f.erp.projectPage(f.demo.users.finance,{page_size:50});assert.ok(count<=5,'Query count must not grow per returned project');}finally{f.db.prepare=original;}
}finally{f.cleanup();}});

test('batched project financial totals agree through advance settlement, returns and linked payment reversal',()=>{const f=fixture();try{
  agree(f);const request=f.spending('2000.00',{kind:'advance',beneficiary:'Synthetic tester',beneficiary_type:'employee',due_date:'2026-04-01'});f.op('manager','request.approve',{id:request});const line=f.erp.get('SELECT id FROM request_lines WHERE request_id=?',request).id;agree(f);
  const advance=f.op('finance','advance.issue',{request_id:request,account_id:1,date:'2026-03-02',reference:'PAGE-ADV'}).id;agree(f);
  f.op('finance','advance.settle',{advance_id:advance,request_line_id:line,amount:'1500.00',date:'2026-03-03',reference:'PAGE-SETTLE',evidence:'Synthetic evidence',documents:[{filename:'receipt.txt',mime:'text/plain',content:Buffer.from('Synthetic receipt').toString('base64')}]});agree(f);
  f.op('finance','advance.return',{advance_id:advance,request_line_id:line,account_id:1,amount:'500.00',date:'2026-03-04',reference:'PAGE-RETURN',evidence:'Synthetic return'});agree(f);
  const payment=f.erp.get('SELECT journal_id AS id FROM payments WHERE bill_id=?',f.demo.bill).id;f.op('finance','journal.reverse',{id:payment,date:'2026-03-05',reference:'PAGE-REVERSE',reason:'Synthetic correction'});agree(f);
}finally{f.cleanup();}});

test('batched summaries preserve conditional funding liability and received-cash treatment',()=>{const f=accountingFixture();try{
  agree(f);const policy=f.op('finance','acc.fund.policy',{source_id:f.demo.source,effective_date:'2026-04-01',restricted:true,receipt_treatment:'deferred',recognition_basis:'eligible_expenditure',allow_transfers:false,reason:'Synthetic grant'}).id;f.op('manager','acc.fund.policy.approve',{id:policy});
  f.op('finance','funding.receive',{source_id:f.demo.source,amount:'10000.00',date:'2026-04-02',account_id:1,treatment:'deferred',reference:'PAGE-DEFERRED'});agree(f);
}finally{f.cleanup();}});

test('HTTP pagination does not limit full financial exports or expose forbidden project details',async()=>{const f=fixture(),server=createApp(f.db);try{
  extraProjects(f,23);await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
  async function login(role){const response=await fetch(root+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:role+'@demo.erp',password:'Demo-only-2026!'})});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
  const cookie=await login('finance'),page=await(await fetch(root+'/api/projects?page=2&page_size=20',{headers:{Cookie:cookie}})).json();assert.equal(page.projects.length,5);
  const csv=await fetch(root+'/api/projects/'+f.demo.project+'/report.csv?from=2026-01-01&to=2026-12-31',{headers:{Cookie:cookie}});assert.equal(csv.status,200);assert.match(await csv.text(),/DEMO-INV-001|6000\.00/);
  const outsider=await login('outsider'),visible=await(await fetch(root+'/api/projects?q=PAGE',{headers:{Cookie:outsider}})).json();assert.equal(visible.pagination.total,0);assert.equal((await fetch(root+'/api/projects/'+page.projects[0].id,{headers:{Cookie:outsider}})).status,403);
  assert.equal((await fetch(root+'/api/projects?page_size=100000',{headers:{Cookie:cookie}})).status,400);
}finally{server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));f.cleanup();}});
