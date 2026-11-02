import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {accountingFixture} from './accounting-helpers.js';
import {createApp} from '../src/server.js';

const evidence=[{filename:'opening-support.txt',mime:'text/plain',content:Buffer.from('Reviewed supporting opening balances and agreement evidence').toString('base64')}];
const line=(f,account,amount,source=f.demo.source)=>({project_id:f.demo.project,source_id:source,account_id:account,amount});
const post=(f,action,data)=>{const id=f.op('finance',action,data).id;f.op('manager','acc.document.approve',{id});return f.op('finance','acc.document.post',{id});};
const doc=(reference,date='2026-04-01')=>({reference,date,reason:'Reviewed acceptance test evidence',documents:evidence});
function conditional(f,amount='2000.00'){
  const source=f.op('manager','source.create',{project_id:f.demo.project,name:'Conditional restricted source',type:'donor',categories:['Operations'],start_date:'2026-01-01',end_date:'2026-12-31'}).id;
  const policy=f.op('finance','acc.fund.policy',{source_id:source,effective_date:'2026-01-01',restricted:true,receipt_treatment:'deferred',recognition_basis:'eligible_expenditure',allow_transfers:true,reason:'Conditional costs evidenced before income recognition'}).id;f.op('manager','acc.fund.policy.approve',{id:policy});
  f.op('finance','funding.receive',{source_id:source,amount,date:'2026-04-01',account_id:1,treatment:'deferred',reference:'DEFERRED-RECEIPT'});return source;
}
function opening(f){const liability=f.erp.accountMapping('supplier_liability'),net=f.erp.accountMapping('fund_balance');return{...doc('SUPPORTED-OPENING','2026-01-01'),lines:[line(f,1,'1000.00'),line(f,liability,'-200.00'),line(f,net,'-800.00')],supporting_balances:[{...line(f,liability,'200.00'),party:'Opening supplier',due_date:'2026-02-01'}]};}

test('opening supplier balances reconcile, partial settlement consumes cash once and reversals retain the support history',()=>{const f=accountingFixture();try{
  const d=opening(f),p=post(f,'acc.opening',d),item=f.erp.get('SELECT id FROM acc_open_items').id,before=f.erp.metrics(f.demo.project);
  assert.equal(f.erp.accountingReport(f.demo.users.finance,'position').totals.closing_cash,'36000.00');assert.equal(f.erp.supplierAging(f.demo.users.finance).find(x=>x.kind==='opening').unpaid,'200.00');assert.ok(f.erp.controlReconciliation(f.demo.users.finance,'2026-12-31').checks.every(x=>x.ok));
  const settlement=post(f,'acc.opening.settle',{...doc('PARTIAL-OPENING-PAYMENT'),item_id:item,amount:'150.00',account_id:1});assert.equal(f.erp.openingItemOutstanding(item),5000);assert.equal(f.erp.metrics(f.demo.project).actual,before.actual);assert.equal(f.erp.accountRoleBalance('supplier_liability'),-205000);
  assert.throws(()=>f.op('finance','journal.reverse',{id:p.journal_id,...doc('PREMATURE-OPENING-REV')}),/Reverse opening settlements/);
  f.op('finance','journal.reverse',{id:settlement.journal_id,...doc('OPENING-SETTLEMENT-REV','2026-04-02')});assert.equal(f.erp.openingItemOutstanding(item),20000);
  f.op('finance','journal.reverse',{id:p.journal_id,...doc('OPENING-REV','2026-04-03')});assert.equal(f.erp.openingItemOutstanding(item),0);assert.equal(f.erp.accountingReport(f.demo.users.finance,'position').totals.closing_cash,'35000.00');
}finally{f.cleanup();}});

test('invalid opening support, wrong control side, duplicate dimensions and numeric money fail without partial evidence',()=>{const f=accountingFixture();try{
  const d=opening(f),count=f.erp.get('SELECT COUNT(*) AS n FROM acc_documents').n;
  for(const input of [{...d,supporting_balances:[]},{...d,supporting_balances:[{...d.supporting_balances[0],account_id:999}]},{...d,lines:[...d.lines,d.lines[0]]},{...d,lines:d.lines.map(x=>({...x,amount:x.amount.startsWith('-')?x.amount.slice(1):'-'+x.amount}))},{...d,lines:d.lines.map(x=>({...x,amount:100}))}])assert.throws(()=>f.op('finance','acc.opening',input),/support|opening|natural|decimal/i);
  assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM acc_documents').n,count);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM acc_evidence').n,0);
}finally{f.cleanup();}});

test('approved opening cash reconciles to bank opening balance without inventing or reusing a statement movement',()=>{const f=accountingFixture();try{
  const account=f.op('admin','account.create',{code:'1030',name:'Opening-supported bank',type:'bank'}).id;
  const opening=post(f,'acc.opening',{...doc('OPENING-BANK','2026-01-01'),lines:[line(f,account,'1000.00'),line(f,f.erp.accountMapping('fund_balance'),'-1000.00')],supporting_balances:[]});
  const statement=f.op('finance','statement.create',{account_id:account,start_date:'2026-01-01',end_date:'2026-12-31',opening_balance:'1000.00',closing_balance:'1000.00',reference:'BANK-OPENING-ONLY',lines:[]}).id;
  f.op('finance','statement.finalize',{id:statement,reason:'Bank opening agrees with the approved supporting balance',reviews:[]});const reconciliation=f.erp.controlReconciliation(f.demo.users.finance,'2026-12-31');assert.equal(reconciliation.ok,true);assert.equal(reconciliation.cash.find(c=>c.account_id===account).documented_outstanding,'0.00');
  assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM statement_lines WHERE statement_id=?',statement).n,0);const cashLine=f.erp.get('SELECT id FROM journal_lines WHERE journal_id=? AND account_id=?',opening.journal_id,account);assert.equal(f.erp.matchedBook(cashLine.id,true),100000);const report=f.erp.accountingReport(f.demo.users.finance,'cash_flow',{from:'2026-01-01',to:'2026-12-31'});assert.equal(report.cash_flow_totals.opening_balances,'1000.00');assert.equal(report.cash_flow_totals.operating,'35000.00');assert.equal(report.totals.closing_cash,'36000.00');
}finally{f.cleanup();}});

test('funding liability becomes income only for accepted eligible expenditure; refund reduces liability and returns cash without cost',()=>{const f=accountingFixture();try{
  const source=conditional(f),request=f.op('requester','request.submit',{title:'Conditional accepted cost',date:'2026-04-02',lines:[{project_id:f.demo.project,source_id:source,category:'Operations',activity:'General',amount:'1500.00'}]}).id;f.op('manager','request.approve',{id:request});const requestLine=f.erp.get('SELECT id FROM request_lines WHERE request_id=?',request).id;
  const po=f.op('manager','po.create',{request_id:request,supplier:'Conditional supplier',date:'2026-04-02',reference:'COND-PO'}).id;f.op('finance','bill.post',{po_id:po,invoice:'COND-BILL',date:'2026-04-02',cost_type:'expense',lines:[{request_line_id:requestLine,amount:'1500.00'}]});
  const recognition=post(f,'acc.funding.submit',{...doc('RECOGNIZE-COST','2026-04-03'),source_id:source,kind:'recognition',from_treatment:'deferred',amount:'1500.00'});assert.equal(f.erp.accountRoleBalance('funding_deferred','9999-12-31',source),-50000);
  const before=f.erp.metrics(f.demo.project);post(f,'acc.funding.submit',{...doc('RETURN-UNUSED','2026-04-04'),source_id:source,kind:'funding_refund',from_treatment:'deferred',amount:'500.00',account_id:1});assert.equal(f.erp.accountRoleBalance('funding_deferred','9999-12-31',source),0);assert.equal(f.erp.metrics(f.demo.project).cash,before.cash-50000);assert.equal(f.erp.metrics(f.demo.project).actual,before.actual);assert.equal(f.erp.sourceBalances(f.demo.project).find(s=>s.id===source).returned,50000);assert.ok(f.erp.controlReconciliation(f.demo.users.finance,'2026-12-31').checks.every(x=>x.ok));
  post(f,'acc.funding.submit',{...doc('RETURN-RECOGNIZED','2026-04-05'),source_id:source,kind:'funding_refund',from_treatment:'income',amount:'1500.00',account_id:1});const count=f.erp.get('SELECT COUNT(*) AS n FROM journals').n;assert.throws(()=>f.op('finance','journal.reverse',{id:recognition.journal_id,...doc('RECOGNITION-DEPENDENCY','2026-04-06')}),/dependent funding treatments/);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM journals').n,count);assert.equal(f.erp.accountRoleBalance('funding_income','9999-12-31',source),0);
}finally{f.cleanup();}});

test('income-funded refunds reverse income and cash; stale policy and legacy refund bypass cannot post',()=>{const f=accountingFixture();try{
  const before=f.erp.metrics(f.demo.project),r=post(f,'acc.funding.submit',{...doc('INCOME-REFUND'),source_id:f.demo.source,kind:'funding_refund',from_treatment:'income',amount:'500.00',account_id:1});assert.equal(f.erp.accountRoleBalance('funding_income'),-3950000);assert.equal(f.erp.metrics(f.demo.project).actual,before.actual);assert.equal(f.erp.sourceBalances(f.demo.project)[0].returned,50000);
  f.op('finance','journal.reverse',{id:r.journal_id,...doc('REFUND-REV','2026-04-02')});assert.equal(f.erp.sourceBalances(f.demo.project)[0].returned,0);
  assert.throws(()=>f.op('finance','funding.return',{...doc('BYPASS'),source_id:f.demo.source,amount:'1.00',account_id:1}),/approved accounting funding refund/);
  const pending=f.op('finance','acc.funding.submit',{...doc('STALE-REFUND'),source_id:f.demo.source,kind:'funding_refund',from_treatment:'income',amount:'1.00',account_id:1}).id;
  const policy=f.op('finance','acc.fund.policy',{source_id:f.demo.source,effective_date:'2026-04-01',restricted:false,receipt_treatment:'income',recognition_basis:'on_receipt',allow_transfers:false,reason:'New agreement excludes allocation transfers'}).id;f.op('manager','acc.fund.policy.approve',{id:policy});assert.throws(()=>f.op('manager','acc.document.approve',{id:pending}),/policy changed/);
}finally{f.cleanup();}});

test('allocation transfer changes fund ownership without new organization income, cash movement or unmatched statement amount',()=>{const f=accountingFixture();try{
  const source=conditional(f),income=f.erp.accountRoleBalance('funding_income'),cash=f.erp.metrics(f.demo.project).cash,posted=post(f,'acc.transfer',{...doc('SAME-BANK-ALLOC'),from_source_id:f.demo.source,to_source_id:source,account_id:1,amount:'500.00'});
  assert.equal(f.erp.accountRoleBalance('funding_income'),income);assert.equal(f.erp.metrics(f.demo.project).cash,cash);const lines=f.erp.all('SELECT * FROM journal_lines WHERE journal_id=? AND account_id=1',posted.journal_id);assert.equal(lines.length,2);for(const l of lines)assert.equal(f.erp.matchedBook(l.id,true),Math.abs(l.amount));
  const flow=f.erp.accountingReport(f.demo.users.finance,'cash_flow',{source_id:source,from:'2026-01-01',to:'2026-12-31'});assert.equal(flow.cash_flow_totals.allocation_changes,'500.00');assert.equal(f.erp.accountingReport(f.demo.users.finance,'cash_flow',{from:'2026-01-01',to:'2026-12-31'}).cash_flow_totals.allocation_changes,'0.00');
  f.op('finance','journal.reverse',{id:posted.journal_id,...doc('ALLOC-REV','2026-04-02')});assert.equal(f.erp.sourceBalances(f.demo.project).find(s=>s.id===source).cash,200000);
}finally{f.cleanup();}});

test('competing approved funding refunds serialize against one supporting liability and retries do not post twice',async()=>{const f=accountingFixture();try{
  const source=conditional(f,'100.00'),ids=['ONE','TWO'].map(ref=>{const id=f.op('finance','acc.funding.submit',{...doc('COMPETING-'+ref),source_id:source,kind:'funding_refund',from_treatment:'deferred',amount:'75.00',account_id:1}).id;f.op('manager','acc.document.approve',{id});return id;});
  const workerCode=`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {openDatabase}=await import(workerData.dbModule);const {ERP}=await import(workerData.serviceModule);const db=openDatabase(workerData.path);try{parentPort.postMessage({ok:true,result:new ERP(db).execute(workerData.actor,'acc.document.post',{id:workerData.id},workerData.key)});}catch(e){parentPort.postMessage({ok:false,error:e.message});}finally{db.close();}})();`;
  const results=await Promise.all(ids.map(id=>new Promise((resolve,reject)=>{const w=new Worker(workerCode,{eval:true,workerData:{path:f.path,actor:f.demo.users.finance,id,key:randomUUID(),dbModule:new URL('../src/db.js',import.meta.url).href,serviceModule:new URL('../src/service.js',import.meta.url).href}});w.on('message',resolve);w.on('error',reject);})));assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.erp.accountRoleBalance('funding_deferred','9999-12-31',source),-2500);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM acc_posts').n,1);
}finally{f.cleanup();}});

test('posting failures roll back journals and idempotency while independent close exceptions cannot hide discrepancies',()=>{const f=accountingFixture();try{
  const id=f.op('finance','acc.manual',{...doc('NO-CASH'),lines:[line(f,1,'-40000.00'),line(f,2,'40000.00')],charges:[]}).id;f.op('manager','acc.document.approve',{id});const count=f.erp.get('SELECT COUNT(*) AS n FROM journals').n;assert.throws(()=>f.op('finance','acc.document.post',{id}),/cash/i);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM journals').n,count);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM acc_posts').n,0);
  assert.throws(()=>f.op('finance','acc.period.close',{id:f.demo.period,reason:'Unposted preparation remains'}),/blockers/);
  f.op('finance','acc.document.cancel',{id,reason:'Unsupported cash amount'});f.op('finance','acc.period.close',{id:f.demo.period,reason:'All supporting balances reviewed'});assert.throws(()=>f.op('admin','acc.account',{account_id:1,name:'Changed historical bank',reporting_type:'asset',reporting_group:'Cash',control_role:'cash',active:true,cash_flow:'cash',effective_date:'2026-12-01',reason:'Locked setup'}),/locked period/);
}finally{f.cleanup();}});

test('HTTP accounting exports and evidence require explicit capability and financial scope; read-only cannot post',async()=>{const f=accountingFixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`;try{
  const id=f.op('finance','acc.manual',{...doc('PRIVATE-EVIDENCE'),lines:[line(f,1,'-1.00'),line(f,2,'1.00')],charges:[]}).id,evidenceId=f.erp.get('SELECT id FROM acc_evidence WHERE document_id=?',id).id;
  async function get(role,path){const {token}=f.erp.login(role+'@demo.erp','Demo-only-2026!');return fetch(root+path,{headers:{Cookie:'erp_session='+token}});}
  for(const path of ['/api/accounting/reports/position','/api/accounting/reports/general_ledger.csv','/api/accounting/reconciliation','/api/accounting/assets.csv','/api/accounting/evidence/'+evidenceId])assert.equal((await get('requester',path)).status,403);
  const report=await get('finance','/api/accounting/reports/position?from=2026-01-01&to=2026-12-31');assert.equal(report.status,200);assert.equal((await report.json()).totals.net_assets,'33000.00');assert.match(await(await get('finance','/api/accounting/reports/general_ledger.csv')).text(),/ACCOUNTING-RECEIPT/);
  const download=await get('finance','/api/accounting/evidence/'+evidenceId);assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');assert.match(await download.text(),/Reviewed supporting/);assert.throws(()=>f.op('admin','acc.manual',{...doc('AUDITOR-POST'),lines:[line(f,1,'-1.00'),line(f,2,'1.00')],charges:[]}),/accounting permission/);
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));f.cleanup();}});
