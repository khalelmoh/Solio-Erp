import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';
import { openDatabase } from '../src/db.js';
import { seedDemo } from '../src/demo.js';
import { money,decimal } from '../src/money.js';

async function concurrent(f,operations) {
  const workers=operations.map(o=>new Worker(new URL('./concurrent-worker.js',import.meta.url),{workerData:{path:f.path,key:randomUUID(),...o}}));
  try {
    await Promise.all(workers.map(w=>new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);})));
    const pending=workers.map(w=>new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);}));
    workers.forEach(w=>w.postMessage('start'));
    return await Promise.all(pending);
  } finally { await Promise.all(workers.map(w=>w.terminate())); }
}
test('required $50k / $40k / $10k / $6k / $4k scenario persists with expected balances',()=>{
  const f=fixture();try {
    assert.deepEqual(f.erp.metrics(f.demo.project),{approved:5000000,promised:5000000,received:4000000,commitment:400000,actual:600000,liability:200000,payments:400000,advances:0,remaining:4000000,cash:3600000});
    const other=openDatabase(f.path);try { assert.equal(new (f.erp.constructor)(other).metrics(f.demo.project).cash,3600000); } finally {other.close();}
  }finally{f.cleanup();}
});
test('all posted journals balance, commitment is separate from payable',()=>{
  const f=fixture();try {
    assert.equal(f.erp.all('SELECT j.id FROM journals j JOIN journal_lines l ON l.journal_id=j.id GROUP BY j.id HAVING SUM(l.amount)<>0').length,0);
    assert.equal(f.erp.metrics(f.demo.project).commitment,400000);
    assert.equal(f.erp.metrics(f.demo.project).liability,200000);
  }finally{f.cleanup();}
});
test('unauthorized reads and writes, including guessed IDs, are denied',()=>{
  const f=fixture();try {
    assert.throws(()=>f.erp.dashboard(f.demo.users.outsider,f.demo.project),/permission denied/);
    assert.throws(()=>f.op('outsider','request.approve',{id:f.demo.request}),/permission denied/);
    assert.throws(()=>f.op('manager','payment.post',{bill_id:f.demo.bill,amount:'1.00',account_id:1,date:'2026-03-01',reference:'FORBIDDEN'}),/permission denied/);
    assert.throws(()=>f.op('manager','membership.set',{project_id:f.demo.project,user_id:f.demo.users.outsider,role:'finance'}),/Administrator/);
  }finally{f.cleanup();}
});
test('self approval is denied for spending and budgets',()=>{
  const f=fixture();try {
    const id=f.op('manager','request.submit',{title:'Manager request',date:'2026-03-01',lines:[{project_id:f.demo.project,source_id:f.demo.source,category:'Equipment',activity:'Outreach',amount:'50.00'}]}).id;
    assert.throws(()=>f.op('manager','request.approve',{id}),/own document/);
    const budget=f.op('manager','budget.submit',{project_id:f.demo.project,reason:'Amendment',lines:[{category:'Equipment',activity:'Outreach',start_date:'2026-01-01',end_date:'2026-12-31',amount:'51000.00'}]}).id;
    assert.throws(()=>f.op('manager','budget.approve',{id:budget}),/own document/);
  }finally{f.cleanup();}
});
test('concurrent budget approvals cannot overspend',async()=>{
  const f=fixture();try {
    const ids=[f.spending('30000.00'),f.spending('30000.00')];
    const results=await concurrent(f,ids.map(id=>({actor:f.demo.users.manager,action:'request.approve',data:{id}})));
    assert.equal(results.filter(r=>r.ok).length,1);assert.match(results.find(r=>!r.ok).error,/Insufficient remaining budget/);
    assert.equal(f.erp.metrics(f.demo.project).remaining,1000000);
    assert.equal(f.erp.all("SELECT * FROM approvals WHERE kind='spending' AND document_id IN(?,?)",...ids).length,1);
  }finally{f.cleanup();}
});
test('payment retries are durable, payload conflicts fail, duplicate bank references fail',()=>{
  const f=fixture();try {
    const d={bill_id:f.demo.bill,amount:'500.00',account_id:1,date:'2026-03-01',reference:'CONTROL-PAY-1'},key=randomUUID();
    const first=f.op('finance','payment.post',d,key),second=f.op('finance','payment.post',d,key);
    assert.deepEqual(first,second);assert.equal(f.erp.metrics(f.demo.project).liability,150000);
    assert.throws(()=>f.op('finance','payment.post',{...d,amount:'100.00'},key),/different operation/);
    assert.throws(()=>f.op('finance','payment.post',d),/Duplicate/);
    assert.equal(f.erp.metrics(f.demo.project).liability,150000);
  }finally{f.cleanup();}
});
test('concurrent duplicate payment posts once even with distinct retry keys',async()=>{
  const f=fixture();try {
    const d={bill_id:f.demo.bill,amount:'500.00',account_id:1,date:'2026-03-01',reference:'CONCURRENT-PAY'};
    const results=await concurrent(f,[1,2].map(()=>({actor:f.demo.users.finance,action:'payment.post',data:d})));
    assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.erp.metrics(f.demo.project).liability,150000);
  }finally{f.cleanup();}
});
test('cancellation releases only unbilled commitment; bill still payable',()=>{
  const f=fixture();try {
    f.op('manager','request.cancel',{id:f.demo.request,reason:'No additional goods needed'});
    const m=f.erp.metrics(f.demo.project);assert.equal(m.commitment,0);assert.equal(m.actual,600000);assert.equal(m.remaining,4400000);assert.equal(m.liability,200000);
    assert.throws(()=>f.op('finance','bill.post',{po_id:f.demo.po,invoice:'AFTER-CANCEL',date:'2026-03-01',lines:[{request_line_id:f.demo.line,amount:'1.00'}]}),/cancelled/);
    f.op('finance','payment.post',{bill_id:f.demo.bill,amount:'2000.00',account_id:1,date:'2026-03-01',reference:'CANCELLED-PO-BILL-PAY'});
    assert.equal(f.erp.metrics(f.demo.project).actual,600000);assert.equal(f.erp.metrics(f.demo.project).liability,0);
  }finally{f.cleanup();}
});
test('advances reduce cash, then accepted expenditure becomes actual; unused money returns',()=>{
  const f=fixture();try {
    const request=f.spending('1000.00');f.op('manager','request.approve',{id:request});
    const line=f.erp.get('SELECT id FROM request_lines WHERE request_id=?',request).id;
    const advance=f.op('finance','advance.issue',{request_id:request,beneficiary:'Demo staff',account_id:1,date:'2026-03-02',reference:'ADV-1'}).id;
    let m=f.erp.metrics(f.demo.project);assert.equal(m.cash,3500000);assert.equal(m.actual,600000);assert.equal(m.advances,100000);assert.equal(m.commitment,500000);
    assert.throws(()=>f.op('manager','request.cancel',{id:request,reason:'Premature'}),/Settle or return/);
    f.op('finance','advance.settle',{advance_id:advance,request_line_id:line,amount:'700.00',date:'2026-03-03',reference:'SETTLE-1',evidence:'Accepted receipt bundle R001'});
    m=f.erp.metrics(f.demo.project);assert.equal(m.actual,670000);assert.equal(m.advances,30000);assert.equal(m.commitment,430000);assert.equal(m.cash,3500000);
    f.op('finance','advance.return',{advance_id:advance,request_line_id:line,amount:'300.00',account_id:1,date:'2026-03-04',reference:'RETURN-1',evidence:'Unused cash returned'});
    f.op('manager','request.cancel',{id:request,reason:'Fully settled, release unused allocation'});
    m=f.erp.metrics(f.demo.project);assert.equal(m.actual,670000);assert.equal(m.advances,0);assert.equal(m.commitment,400000);assert.equal(m.cash,3530000);
  }finally{f.cleanup();}
});
test('material request edits preserve history, release reservations and require reapproval',()=>{
  const f=fixture();try {
    const id=f.spending('1000.00');f.op('manager','request.approve',{id});
    const replacement=f.op('requester','request.edit',{id,title:'Revised request',date:'2026-03-01',lines:[{project_id:f.demo.project,source_id:f.demo.source,category:'Equipment',activity:'Outreach',amount:'1500.00'}]});
    assert.equal(replacement.reapproval_required,true);assert.equal(f.erp.metrics(f.demo.project).commitment,400000);
    assert.equal(f.erp.get('SELECT state FROM requests WHERE id=?',id).state,'cancelled');
    assert.equal(f.erp.get('SELECT supersedes_id FROM requests WHERE id=?',replacement.id).supersedes_id,id);
    assert.throws(()=>f.op('manager','po.create',{request_id:replacement.id,supplier:'Vendor',reference:'EDIT-PO',date:'2026-03-02'}),/approved/);
    f.op('manager','request.approve',{id:replacement.id});assert.equal(f.erp.metrics(f.demo.project).commitment,550000);
  }finally{f.cleanup();}
});
test('budget amendments retain originals and cannot move consumed categories/periods away',()=>{
  const f=fixture();try {
    const original=f.erp.currentBudget(f.demo.project);
    const id=f.op('manager','budget.submit',{project_id:f.demo.project,reason:'Approved additional award',lines:[{category:'Equipment',activity:'Outreach',start_date:'2026-01-01',end_date:'2026-12-31',amount:'55000.00'}]}).id;
    f.op('finance','budget.approve',{id});assert.equal(f.erp.metrics(f.demo.project).approved,5500000);
    assert.equal(f.erp.get('SELECT SUM(amount) AS n FROM budget_lines WHERE budget_id=?',original.id).n,5000000);
    const bad=f.op('manager','budget.submit',{project_id:f.demo.project,reason:'Invalid category removal',lines:[{category:'Other',activity:'Outreach',start_date:'2026-01-01',end_date:'2026-12-31',amount:'55000.00'}]}).id;
    assert.throws(()=>f.op('finance','budget.approve',{id:bad}),/outside its categories/);
  }finally{f.cleanup();}
});
test('configured multiple approval levels preserve independent approval and reserve only at final level',()=>{
  const f=fixture();try {
    f.op('admin','policy.set',{kind:'spending',rules:[{min:'0.00',max:null,levels:[['manager'],['finance']]}]});
    const id=f.spending('100.00');f.op('manager','request.approve',{id});assert.equal(f.erp.metrics(f.demo.project).commitment,400000);
    assert.throws(()=>f.op('manager','request.approve',{id}),/distinct approver/);
    f.op('finance','request.approve',{id});assert.equal(f.erp.metrics(f.demo.project).commitment,410000);
  }finally{f.cleanup();}
});
test('funding restrictions enforce project, category and dates',()=>{
  const f=fixture();try {
    const source=f.op('manager','source.create',{project_id:f.demo.project,name:'Restricted demo',type:'donor',categories:['Equipment'],start_date:'2026-04-01',end_date:'2026-05-31'}).id;
    const base={title:'Restricted',date:'2026-03-01',lines:[{project_id:f.demo.project,source_id:source,category:'Equipment',activity:'Outreach',amount:'10.00'}]};
    assert.throws(()=>f.op('requester','request.submit',base),/outside funding source eligibility/);
    assert.throws(()=>f.op('requester','request.submit',{...base,date:'2026-04-01',lines:[{...base.lines[0],category:'Travel'}]}),/not eligible/);
    assert.throws(()=>f.op('admin','request.submit',{...base,date:'2026-04-01',lines:[{...base.lines[0],project_id:f.demo.overhead}]}),/belongs to another project/);
  }finally{f.cleanup();}
});
test('budget approval is not funding and cash account allocations cannot be overdrawn',()=>{
  const f=fixture();try {
    const id=f.spending('38000.00');f.op('manager','request.approve',{id});
    assert.equal(f.erp.metrics(f.demo.project).cash,3600000);
    assert.throws(()=>f.op('finance','advance.issue',{request_id:id,beneficiary:'Staff',account_id:1,date:'2026-03-02',reference:'NO-CASH'}),/Insufficient project\/source cash/);
  }finally{f.cleanup();}
});
test('partial bill overcharges and duplicate invoices are rejected without partial posting',()=>{
  const f=fixture();try {
    const before=f.erp.metrics(f.demo.project);
    assert.throws(()=>f.op('finance','bill.post',{po_id:f.demo.po,invoice:'OVER-BILL',date:'2026-03-01',lines:[{request_line_id:f.demo.line,amount:'4000.01'}]}),/exceeds outstanding/);
    assert.throws(()=>f.op('finance','bill.post',{po_id:f.demo.po,invoice:'DEMO-INV-001',date:'2026-03-01',lines:[{request_line_id:f.demo.line,amount:'100.00'}]}),/Duplicate/);
    assert.deepEqual(f.erp.metrics(f.demo.project),before);
  }finally{f.cleanup();}
});
test('posted evidence and approved budgets are immutable at database level',()=>{
  const f=fixture();try {
    const j=f.erp.get('SELECT id FROM journals LIMIT 1').id;
    assert.throws(()=>f.db.prepare('UPDATE journals SET description=? WHERE id=?').run('tampered',j),/immutable/);
    assert.throws(()=>f.db.prepare('DELETE FROM journal_lines WHERE journal_id=?').run(j),/immutable/);
    assert.throws(()=>f.db.prepare('UPDATE budget_charges SET amount=1').run(),/Immutable/);
    assert.throws(()=>f.db.prepare('UPDATE budget_versions SET state=? WHERE id=?').run('submitted',f.erp.currentBudget(f.demo.project).id),/immutable/);
    assert.throws(()=>f.db.prepare('DELETE FROM approvals').run(),/Immutable/);
  }finally{f.cleanup();}
});
test('linked payment and bill reversals restore liability then commitment, without deletion',()=>{
  const f=fixture();try {
    const bill=f.erp.get('SELECT * FROM bills WHERE id=?',f.demo.bill),payment=f.erp.get('SELECT * FROM payments WHERE bill_id=?',bill.id);
    assert.throws(()=>f.op('finance','journal.reverse',{id:bill.journal_id,date:'2026-03-01',reference:'BAD-REV',reason:'Wrong invoice'}),/Reverse linked payments/);
    f.op('finance','journal.reverse',{id:payment.journal_id,date:'2026-03-01',reference:'REV-PAY',reason:'Incorrect payment entry'});
    let m=f.erp.metrics(f.demo.project);assert.equal(m.liability,600000);assert.equal(m.cash,4000000);assert.equal(m.actual,600000);
    f.op('finance','journal.reverse',{id:bill.journal_id,date:'2026-03-01',reference:'REV-BILL',reason:'Incorrect invoice entry'});
    m=f.erp.metrics(f.demo.project);assert.equal(m.actual,0);assert.equal(m.commitment,1000000);assert.equal(m.liability,0);assert.equal(f.erp.all('SELECT * FROM bills').length,1);
  }finally{f.cleanup();}
});
test('asset purchases charge budget but do not debit expense',()=>{
  const f=fixture();try {
    f.op('finance','bill.post',{po_id:f.demo.po,invoice:'ASSET-BILL',date:'2026-03-01',cost_type:'asset',lines:[{request_line_id:f.demo.line,amount:'1000.00'}]});
    assert.equal(f.erp.metrics(f.demo.project).actual,700000);
    assert.equal(f.erp.get("SELECT SUM(l.amount) AS n FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE a.type='expense'").n,600000);
    assert.equal(f.erp.get("SELECT SUM(l.amount) AS n FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE a.type='asset'").n,100000);
  }finally{f.cleanup();}
});
test('internal transfers preserve funding, actual charges and organization/project total cash',()=>{
  const f=fixture();try {
    const before=f.erp.metrics(f.demo.project);
    f.op('finance','cash.transfer',{source_id:f.demo.source,from_account_id:1,to_account_id:3,amount:'1000.00',date:'2026-03-01',reference:'TRANSFER-1'});
    assert.deepEqual(f.erp.metrics(f.demo.project),before);assert.equal(f.erp.cash(f.demo.project,f.demo.source,3),100000);
    const organization=f.erp.get("SELECT SUM(l.amount) AS n FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE a.type IN('bank','cash','mobile')").n;
    assert.equal(organization,f.erp.all('SELECT id FROM projects').reduce((n,p)=>n+f.erp.metrics(p.id).cash,0));
  }finally{f.cleanup();}
});
test('reconciliation requires zero difference and closure blocks unresolved obligations',()=>{
  const f=fixture();try {
    assert.throws(()=>f.op('admin','reconcile',{account_id:1,date:'2026-03-01',statement_balance:'35999.00',outstanding_line_ids:[]}),/difference/);
    const r=f.op('admin','reconcile',{account_id:1,date:'2026-03-01',statement_balance:'36000.00',outstanding_line_ids:[]});assert.equal(r.difference,'0.00');
    assert.throws(()=>f.op('manager','project.close',{id:f.demo.project}),/zero commitments/);
    f.op('admin','project.complete',{id:f.demo.overhead,reason:'No operational obligations'});f.op('admin','project.close',{id:f.demo.overhead});assert.equal(f.erp.get('SELECT status FROM projects WHERE id=?',f.demo.overhead).status,'closed');
    assert.throws(()=>f.op('admin','source.create',{project_id:f.demo.overhead,name:'Closed source',type:'organization',categories:[],start_date:'2026-01-01',end_date:'2026-12-31'}),/closed/);
  }finally{f.cleanup();}
});
test('closed accounting periods block financial writes',()=>{
  const f=fixture();try {
    const period=f.erp.get('SELECT * FROM periods LIMIT 1');f.op('admin','period.set',{...period,state:'closed'});
    assert.throws(()=>f.op('finance','funding.receive',{source_id:f.demo.source,account_id:1,amount:'10.00',date:'2026-03-01',reference:'CLOSED-RECEIPT'}),/No open accounting period/);
  }finally{f.cleanup();}
});
test('explicit exception permits only its authorized category overrun amount',()=>{
  const f=fixture();try {
    const id=f.spending('40001.00');assert.throws(()=>f.op('manager','request.approve',{id}),/authorized exception/);
    f.op('finance','exception.authorize',{project_id:f.demo.project,amount:'1.00',expiry:'2099-12-31',reason:'Test authorized marginal overrun'});
    f.op('manager','request.approve',{id});assert.equal(f.erp.metrics(f.demo.project).remaining,-100);
    const excess=f.spending('0.01');assert.throws(()=>f.op('manager','request.approve',{id:excess}),/authorized exception/);
  }finally{f.cleanup();}
});
test('decimal input is exact, excess precision/float input and invalid dates are rejected',()=>{
  assert.equal(money('0.29'),29);assert.equal(decimal(100001),'1000.01');assert.throws(()=>money(0.29),/decimal string/);assert.throws(()=>money('0.001'),/two decimal places/);assert.throws(()=>money('-1.00'),/bounds/);
  const f=fixture();try {assert.throws(()=>f.spending('1.00',{date:'2026-02-30'}),/Invalid ISO date/);}finally{f.cleanup();}
});
test('demo seed refuses a populated database and migration reruns preserve records',()=>{
  const f=fixture();try {
    assert.throws(()=>seedDemo(f.db),/empty database/);
    const db=openDatabase(f.path);try {assert.equal(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,13);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,5);}finally{db.close();}
  }finally{f.cleanup();}
});

test('concurrent advance issues cannot overdraw shared project cash',async()=>{
  const f=fixture();try {
    const requests=[f.spending('20000.00'),f.spending('20000.00')];for(const id of requests)f.op('manager','request.approve',{id});
    const results=await concurrent(f,requests.map((id,i)=>({actor:f.demo.users.finance,action:'advance.issue',data:{request_id:id,beneficiary:'Staff',account_id:1,date:'2026-03-02',reference:`CASH-RACE-${i}`}})));
    assert.equal(results.filter(r=>r.ok).length,1);assert.match(results.find(r=>!r.ok).error,/Insufficient project\/source cash/);assert.equal(f.erp.metrics(f.demo.project).cash,1600000);
  }finally{f.cleanup();}
});

test('split-project costs, exact payment cents and scoped bill balances stay consistent',()=>{
  const f=fixture();try {
    f.op('admin','membership.set',{project_id:f.demo.overhead,user_id:f.demo.users.requester,role:'requester'});
    const budget=f.op('manager','budget.submit',{project_id:f.demo.overhead,reason:'Overhead budget',lines:[{category:'Admin',activity:'General',start_date:'2026-01-01',end_date:'2026-12-31',amount:'1000.00'}]}).id;f.op('finance','budget.approve',{id:budget});
    const source=f.op('manager','source.create',{project_id:f.demo.overhead,name:'Organization resources',type:'organization',categories:['Admin'],start_date:'2026-01-01',end_date:'2026-12-31'}).id;
    f.op('finance','funding.receive',{source_id:source,account_id:1,amount:'1000.00',reference:'OVERHEAD-FUND',date:'2026-03-01'});
    const r=f.op('requester','request.submit',{title:'Split cost',date:'2026-03-01',lines:[{project_id:f.demo.project,source_id:f.demo.source,category:'Equipment',activity:'Outreach',amount:'600.00'},{project_id:f.demo.overhead,source_id:source,category:'Admin',activity:'General',amount:'400.00'}]}).id;
    f.op('manager','request.approve',{id:r});
    const po=f.op('manager','po.create',{request_id:r,supplier:'Split supplier',reference:'SPLIT-PO',date:'2026-03-01'}).id;
    const lines=f.erp.all('SELECT * FROM request_lines WHERE request_id=?',r);
    const bill=f.op('finance','bill.post',{po_id:po,invoice:'SPLIT-INV',date:'2026-03-01',lines:lines.map(l=>({request_line_id:l.id,amount:decimal(l.amount)}))}).id;
    f.op('admin','membership.set',{project_id:f.demo.project,user_id:f.demo.users.outsider,role:'viewer'});
    const visible=f.erp.dashboard(f.demo.users.outsider,f.demo.project).bills.find(b=>b.id===bill);assert.equal(visible.unpaid,'600.00');assert.equal(visible.lines.length,1);assert.equal(visible.total_unpaid,undefined);assert.equal(visible.can_pay,false);
    for(const [i,amount]of ['333.33','666.67'].entries())f.op('finance','payment.post',{bill_id:bill,amount,account_id:1,reference:`SPLIT-PAY-${i}`,date:'2026-03-02'});
    assert.equal(f.erp.projectUnpaid(f.erp.get('SELECT * FROM bills WHERE id=?',bill),f.demo.overhead),0);
    assert.equal(f.erp.projectUnpaid(f.erp.get('SELECT * FROM bills WHERE id=?',bill),f.demo.project),0);
    assert.equal(f.erp.metrics(f.demo.project).liability,200000);assert.equal(f.erp.metrics(f.demo.overhead).liability,0);assert.equal(f.erp.metrics(f.demo.overhead).cash,60000);
    const organization=f.erp.get("SELECT SUM(l.amount) AS n FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE a.type IN('bank','cash','mobile')").n;
    assert.equal(organization,f.erp.metrics(f.demo.project).cash+f.erp.metrics(f.demo.overhead).cash);
  }finally{f.cleanup();}
});

test('policy changes do not silently change submitted approval requirements',()=>{
  const f=fixture();try {
    const id=f.spending('100.00');
    f.op('admin','policy.set',{kind:'spending',rules:[{min:'0.00',max:null,levels:[['manager'],['finance']]}]});
    const result=f.op('manager','request.approve',{id});assert.equal(result.state,'approved');
    assert.throws(()=>f.op('admin','policy.set',{kind:'spending',rules:[{min:'1.00',max:null,levels:[['manager']]}]}),/without gaps/);
  }finally{f.cleanup();}
});

test('backdated cash movements invalidate reconciliation before project closure',()=>{
  const f=fixture();try {
    const source=f.op('manager','source.create',{project_id:f.demo.overhead,name:'Closure source',type:'organization',categories:[],start_date:'2026-01-01',end_date:'2026-12-31'}).id;
    const receipt=f.op('finance','funding.receive',{source_id:source,account_id:2,amount:'100.00',date:'2026-03-01',reference:'CLOSE-CASH'}).id;
    f.op('finance','journal.reverse',{id:receipt,date:'2026-03-01',reference:'CLOSE-REV',reason:'No funding required'});
    f.op('admin','reconcile',{account_id:2,date:'2026-03-31',statement_balance:'0.00',outstanding_line_ids:[]});
    const later=f.op('finance','funding.receive',{source_id:source,account_id:2,amount:'50.00',date:'2026-03-02',reference:'BACKDATED'}).id;
    f.op('finance','journal.reverse',{id:later,date:'2026-03-02',reference:'BACKDATED-REV',reason:'Correct backdated movement'});
    assert.throws(()=>f.op('manager','project.close',{id:f.demo.overhead}),/current reconciliation/);
    f.op('admin','reconcile',{account_id:2,date:'2026-03-31',statement_balance:'0.00',outstanding_line_ids:[]});
    for(const original of [receipt,later]){const reversed=f.erp.get('SELECT id FROM journals WHERE reversal_of=?',original).id;const ids=[original,reversed].map(j=>f.erp.get('SELECT id FROM journal_lines WHERE journal_id=? AND account_id=2',j).id);f.op('admin','reconciliation.offset',{line_ids:ids,reason:'Book-only funding entry and correction, reviewed against the bank'});}
    f.op('manager','project.complete',{id:f.demo.overhead,reason:'Operational work complete'});f.op('manager','project.close',{id:f.demo.overhead});assert.equal(f.erp.get('SELECT status FROM projects WHERE id=?',f.demo.overhead).status,'closed');
  }finally{f.cleanup();}
});
