import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { fixture } from './helpers.js';
import { decimal } from '../src/money.js';
import { parseCSV,exportCSV } from '../src/csv.js';

export const receipt=()=>({filename:'receipt.txt',mime:'text/plain',content:Buffer.from('Accepted supporting receipt, reference TEST-001').toString('base64')});
function newAdvance(f) {
  const request=f.spending('2000.00',{kind:'advance',beneficiary:'Staff test beneficiary',beneficiary_type:'employee',due_date:'2026-04-01'});f.op('manager','request.approve',{id:request});
  const line=f.erp.get('SELECT id FROM request_lines WHERE request_id=?',request).id;
  const id=f.op('finance','advance.issue',{request_id:request,account_id:1,date:'2026-03-02',reference:'LIFECYCLE-ADV'}).id;return{request,line,id};
}
function createStatement(f,extra={}) {
  const id=f.op('admin','statement.import',{account_id:1,reference:'BANK-STMT-001',start_date:'2026-01-01',end_date:'2026-02-28',opening_balance:'0.00',closing_balance:'36000.00',csv:'external_id,date,description,amount\nBANK-A,2026-02-02,"Funding, first part",25000.00\nBANK-B,2026-02-02,Funding second part,15000.00\nBANK-P,2026-02-06,Payment,-4000.00\n',...extra}).id;
  return{id,lines:f.erp.all('SELECT * FROM statement_lines WHERE statement_id=? ORDER BY id',id),receipt:f.erp.get("SELECT l.id FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.kind='receipt' AND l.account_id=1").id,payment:f.erp.get("SELECT l.id FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.kind='payment' AND l.account_id=1").id};
}
test('advance acceptance: issue $2k, partially accept $1.5k and return $500 without charging cash twice',()=>{
  const f=fixture();try {
    const before=f.erp.metrics(f.demo.project),a=newAdvance(f);let m=f.erp.metrics(f.demo.project);assert.equal(m.cash,before.cash-200000);assert.equal(m.actual,before.actual);
    assert.throws(()=>f.op('finance','advance.settle',{advance_id:a.id,request_line_id:a.line,amount:'700.00',date:'2026-03-03',reference:'NO-RECEIPT',evidence:'Missing receipt'}),/receipts are required/);
    for(const [i,amount]of ['700.00','800.00'].entries())f.op('finance','advance.settle',{advance_id:a.id,request_line_id:a.line,amount,date:'2026-03-03',reference:`ACCEPT-${i}`,evidence:'Approved supporting receipt',documents:[receipt()]});
    m=f.erp.metrics(f.demo.project);assert.equal(m.cash,before.cash-200000);assert.equal(m.actual,before.actual+150000);assert.equal(m.advances,50000);
    f.op('finance','advance.return',{advance_id:a.id,request_line_id:a.line,account_id:1,amount:'500.00',date:'2026-03-04',reference:'UNUSED-RETURN',evidence:'Unused money returned'});
    m=f.erp.metrics(f.demo.project);assert.equal(m.cash,before.cash-150000);assert.equal(m.actual,before.actual+150000);assert.equal(m.advances,0);assert.equal(m.commitment,before.commitment);assert.equal(f.erp.balance(a.line),0);
    const details=f.erp.dashboard(f.demo.users.finance,f.demo.project).advances.find(x=>x.id===a.id);assert.equal(details.issued,'2000.00');assert.equal(details.settled,'1500.00');assert.equal(details.returned,'500.00');assert.equal(details.outstanding,'0.00');assert.equal(details.movements[0].documents.length,1);
  }finally{f.cleanup();}
});
test('advance reservations are separate, overdue advances are visible, and advance requests cannot create POs',()=>{
  const f=fixture();try {
    const a=newAdvance(f),d=f.erp.dashboard(f.demo.users.finance,f.demo.project);assert.equal(d.metrics.advance_reservations,'2000.00');assert.equal(d.metrics.purchase_commitments,'4000.00');assert.equal(d.metrics.remaining,'38000.00');assert.equal(d.advances[0].overdue,true);
    assert.throws(()=>f.op('manager','po.create',{request_id:a.request,supplier:'Vendor',reference:'DOUBLE-RESERVE',date:'2026-03-02'}),/advance request/);
    assert.throws(()=>f.op('requester','advance.return',{advance_id:a.id,request_line_id:a.line,account_id:1,amount:'1.00',date:'2026-03-03',reference:'UNAUTHORIZED-RETURN',evidence:'No authority'}),/permission denied/);
  }finally{f.cleanup();}
});
test('budget increase/reduction/transfer preserve evidence and become effective only after approval',()=>{
  const f=fixture();try {
    const increase=f.op('manager','budget.amend',{project_id:f.demo.project,change_kind:'increase',reason:'New award',documents:[receipt()],lines:[{category:'Equipment',activity:'Outreach',start_date:'2026-01-01',end_date:'2026-12-31',amount:'50000.00'},{category:'Travel',activity:'Outreach',start_date:'2026-01-01',end_date:'2026-12-31',amount:'10000.00'}]}).id;
    assert.equal(f.erp.metrics(f.demo.project).approved,5000000);f.op('finance','budget.approve',{id:increase});assert.equal(f.erp.metrics(f.demo.project).approved,6000000);
    const lines=f.erp.all('SELECT * FROM budget_lines WHERE budget_id=?',increase);
    const transfer=f.op('manager','budget.transfer',{project_id:f.demo.project,from_line_id:lines[0].id,to_line_id:lines[1].id,amount:'5000.00',reason:'Transfer to travel',documents:[receipt()]}).id;
    assert.equal(f.erp.currentBudget(f.demo.project).id,increase);f.op('finance','budget.approve',{id:transfer});assert.equal(f.erp.metrics(f.demo.project).approved,6000000);
    assert.equal(f.erp.get("SELECT amount FROM budget_lines WHERE budget_id=? AND category='Equipment'",transfer).amount,4500000);
    assert.equal(f.erp.get("SELECT amount FROM budget_lines WHERE budget_id=? AND category='Travel'",transfer).amount,1500000);
    assert.equal(f.erp.documents('budget',transfer).length,1);assert.equal(f.erp.get('SELECT kind FROM budget_changes WHERE budget_id=?',transfer).kind,'transfer');assert.equal(f.erp.all("SELECT * FROM approvals WHERE kind='budget' AND document_id=?",transfer).length,1);
    assert.throws(()=>f.db.prepare('UPDATE documents SET filename=? WHERE id=?').run('changed',f.erp.documents('budget',transfer)[0].id),/Immutable/);
  }finally{f.cleanup();}
});
test('budget reductions and transfers cannot uncover actuals/commitments without an explicit exception',()=>{
  const f=fixture();try {
    const proposal=f.op('manager','budget.amend',{project_id:f.demo.project,change_kind:'reduction',reason:'Cannot cover current obligations',lines:[{category:'Equipment',activity:'Outreach',start_date:'2026-01-01',end_date:'2026-12-31',amount:'5000.00'}]}).id;
    assert.throws(()=>f.op('finance','budget.approve',{id:proposal}),/authorized exception/);assert.equal(f.erp.metrics(f.demo.project).approved,5000000);
    f.op('finance','exception.authorize',{project_id:f.demo.project,amount:'5000.00',expiry:'2099-12-31',reason:'Explicit authority to retain uncovered commitments'});f.op('finance','budget.approve',{id:proposal});assert.equal(f.erp.metrics(f.demo.project).remaining,-500000);
  }finally{f.cleanup();}
});
test('credit note reduces liability first, paid excess becomes receivable, refund raises cash only',()=>{
  const f=fixture();try {
    const line=f.erp.get('SELECT id FROM bill_lines WHERE bill_id=?',f.demo.bill).id;
    const credit=f.op('finance','credit.post',{bill_id:f.demo.bill,reference:'CREDIT-2500',date:'2026-03-01',reason:'Returned equipment',lines:[{bill_line_id:line,amount:'2500.00'}],documents:[receipt()]}).id;
    let m=f.erp.metrics(f.demo.project);assert.equal(m.actual,350000);assert.equal(m.liability,0);assert.equal(m.commitment,400000);assert.equal(m.cash,3600000);assert.equal(f.erp.refundAllocations(f.erp.get('SELECT * FROM credit_notes WHERE id=?',credit))[0].outstanding,50000);
    const refund=f.op('finance','supplier.refund',{credit_id:credit,account_id:1,amount:'500.00',reference:'REFUND-500',date:'2026-03-02'});m=f.erp.metrics(f.demo.project);assert.equal(m.cash,3650000);assert.equal(m.actual,350000);assert.equal(m.liability,0);
    assert.throws(()=>f.op('finance','supplier.refund',{credit_id:credit,account_id:1,amount:'0.01',reference:'DOUBLE-REFUND',date:'2026-03-02'}),/exceeds outstanding/);
    assert.throws(()=>f.op('finance','journal.reverse',{id:f.erp.get('SELECT journal_id FROM credit_notes WHERE id=?',credit).journal_id,reference:'BAD-CREDIT-REV',date:'2026-03-03',reason:'Correction'}),/Reverse refunds/);
    f.op('finance','journal.reverse',{id:refund.journal_id,reference:'REFUND-REV',date:'2026-03-03',reason:'Incorrect refund posting'});
    f.op('finance','journal.reverse',{id:f.erp.get('SELECT journal_id FROM credit_notes WHERE id=?',credit).journal_id,reference:'CREDIT-REV',date:'2026-03-03',reason:'Incorrect credit posting'});
    m=f.erp.metrics(f.demo.project);assert.equal(m.actual,600000);assert.equal(m.cash,3600000);assert.equal(m.liability,200000);
  }finally{f.cleanup();}
});
test('credit replacement-goods choice restores commitment once; subsequent bill cannot exceed it',()=>{
  const f=fixture();try {
    const line=f.erp.get('SELECT id FROM bill_lines WHERE bill_id=?',f.demo.bill).id;
    f.op('finance','credit.post',{bill_id:f.demo.bill,reference:'REPLACEMENT-CREDIT',date:'2026-03-01',reason:'Replacement remains on order',restore_commitment:true,lines:[{bill_line_id:line,amount:'1000.00'}]});
    const m=f.erp.metrics(f.demo.project);assert.equal(m.actual,500000);assert.equal(m.commitment,500000);assert.equal(m.remaining,4000000);
    assert.throws(()=>f.op('finance','credit.post',{bill_id:f.demo.bill,reference:'TOO-MUCH-CREDIT',date:'2026-03-01',reason:'Duplicate goods credit',lines:[{bill_line_id:line,amount:'5000.01'}]}),/exceeds remaining/);
  }finally{f.cleanup();}
});
test('statement import and partial many-to-many matching never post expenses and prevent duplicate amounts',()=>{
  const f=fixture();try {
    const s=createStatement(f),before=f.erp.metrics(f.demo.project),journals=f.erp.all('SELECT id FROM journals').length;
    for(const [line,book,amount,reference]of [[s.lines[0].id,s.receipt,'25000.00','MATCH-A'],[s.lines[1].id,s.receipt,'15000.00','MATCH-B'],[s.lines[2].id,s.payment,'2000.00','MATCH-P1']])f.op('admin','statement.match',{statement_line_id:line,journal_line_id:book,amount,reference});
    assert.throws(()=>f.op('admin','statement.match',{statement_line_id:s.lines[0].id,journal_line_id:s.receipt,amount:'1.00',reference:'DUP-MATCH'}),/unreconciled/);
    assert.throws(()=>f.op('admin','statement.finalize',{id:s.id}),/Match all/);
    f.op('admin','statement.match',{statement_line_id:s.lines[2].id,journal_line_id:s.payment,amount:'2000.00',reference:'MATCH-P2'});f.op('admin','statement.finalize',{id:s.id,reviews:[]});
    assert.equal(f.erp.statementDetails(f.demo.users.admin,s.id).difference,'0.00');assert.equal(f.erp.statementState(s.id),'finalized');assert.deepEqual(f.erp.metrics(f.demo.project),before);assert.equal(f.erp.all('SELECT id FROM journals').length,journals);
    assert.throws(()=>f.op('admin','statement.finalize',{id:s.id}),/already finalized/);
    assert.throws(()=>createStatement(f,{reference:'DUPLICATE-FILE'}),/overlaps/);
    const match=f.erp.get('SELECT id FROM statement_matches LIMIT 1').id;assert.throws(()=>f.op('admin','statement.unmatch',{id:match,reason:'Correction'}),/Reopen/);f.op('admin','statement.reopen',{id:s.id,reason:'Review incorrect matching'});f.op('admin','statement.unmatch',{id:match,reason:'Unmatched for review'});assert.equal(f.erp.statementDetails(f.demo.users.admin,s.id).lines[0].unmatched,'25000.00');
  }finally{f.cleanup();}
});
test('concurrent matching attempts cannot reconcile the same statement amount twice',async()=>{
  const f=fixture();const workers=[];try {
    const s=createStatement(f);
    for(const i of [1,2])workers.push(new Worker(new URL('./concurrent-worker.js',import.meta.url),{workerData:{path:f.path,actor:f.demo.users.admin,action:'statement.match',data:{statement_line_id:s.lines[0].id,journal_line_id:s.receipt,amount:'25000.00',reference:`RACE-MATCH-${i}`},key:randomUUID()}}));
    await Promise.all(workers.map(w=>new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);})));const results=workers.map(w=>new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);}));workers.forEach(w=>w.postMessage('start'));
    const all=await Promise.all(results);assert.equal(all.filter(r=>r.ok).length,1);assert.equal(f.erp.matchedStatement(s.lines[0].id),2500000);
  }finally{await Promise.all(workers.map(w=>w.terminate()));f.cleanup();}
});
test('locked-period corrections require independent named authorization and open correction date',()=>{
  const f=fixture();try {
    const period=f.erp.get('SELECT * FROM periods LIMIT 1'),payment=f.erp.get('SELECT * FROM payments WHERE bill_id=?',f.demo.bill);f.op('admin','period.set',{...period,state:'closed'});
    assert.throws(()=>f.op('admin','period.set',{...period,state:'open'}),/cannot be reopened/);
    f.op('admin','period.set',{start_date:'2027-01-01',end_date:'2027-12-31',state:'open'});
    const reverse={id:payment.journal_id,date:'2027-01-01',reference:'LOCKED-REV',reason:'Correct closed-year payment'};assert.throws(()=>f.op('finance','journal.reverse',reverse),/Locked-period correction/);
    const auth=f.op('admin','correction.authorize',{journal_id:payment.journal_id,poster_id:f.demo.users.finance,expiry:'2099-12-31',reason:'Approved prior-year correction'}).id;
    f.op('finance','journal.reverse',{...reverse,authorization_id:auth});assert.equal(f.erp.metrics(f.demo.project).cash,4000000);assert.equal(f.erp.metrics(f.demo.project).actual,600000);assert.equal(f.erp.all('SELECT * FROM correction_uses').length,1);
    assert.throws(()=>f.op('manager','journal.reverse',{...reverse,reference:'WRONG-POSTER',authorization_id:auth}),/unused independent authorization/);
  }finally{f.cleanup();}
});
test('financial closure with an outstanding advance is blocked; operational completion still permits settlement',()=>{
  const f=fixture();try {
    const a=newAdvance(f);f.op('manager','project.complete',{id:f.demo.project,reason:'Field work complete'});
    assert.throws(()=>f.op('manager','project.close',{id:f.demo.project}),/Financial close requires/);
    assert.throws(()=>f.spending('1.00'),/operationally complete/);
    f.op('finance','advance.return',{advance_id:a.id,request_line_id:a.line,amount:'2000.00',account_id:1,date:'2026-03-03',reference:'AFTER-COMPLETION-RETURN',evidence:'All unused money returned'});assert.equal(f.erp.advanceOutstanding(a.request),0);
    const d=f.erp.dashboard(f.demo.users.manager,f.demo.project);assert.equal(d.project.operational_state,'completed');assert.ok(d.closeout.blockers.some(b=>b.type==='liability'));
    assert.throws(()=>f.op('manager','project.reopen',{id:f.demo.project,reason:'Manager has no organization authority'}),/Administrator/);
    f.op('admin','project.reopen',{id:f.demo.project,reason:'Authorized additional work'});assert.equal(f.erp.get('SELECT operational_state FROM projects WHERE id=?',f.demo.project).operational_state,'open');
  }finally{f.cleanup();}
});
test('closeout exceptions require independent authority, exact current treatments, and audit-backed reopening',()=>{
  const f=fixture();try {
    newAdvance(f);f.op('manager','project.complete',{id:f.demo.project,reason:'Completed with transferred administration responsibility'});
    const blockers=f.erp.closeout(f.demo.project).blockers,treatments=blockers.map(b=>({key:b.key,amount:decimal(b.amount),owner_id:f.demo.users.finance,treatment:'Finance retains responsibility; reopen for settlement under documented authority'}));
    const auth=f.op('admin','closure.authorize',{project_id:f.demo.project,closer_id:f.demo.users.manager,expiry:'2099-12-31',reason:'Authorized exceptional administrative closeout',treatments,documents:[receipt()]}).id;
    f.op('manager','project.close',{id:f.demo.project,authorization_id:auth});assert.equal(f.erp.get('SELECT status FROM projects WHERE id=?',f.demo.project).status,'closed');assert.equal(f.erp.metrics(f.demo.project).advances,200000);
    assert.throws(()=>f.op('finance','funding.receive',{source_id:f.demo.source,account_id:1,amount:'1.00',reference:'CLOSED-POST',date:'2026-03-03'}),/closed/);
    f.op('admin','project.reopen',{id:f.demo.project,reason:'Reopen for controlled liquidation'});assert.ok(f.erp.get("SELECT id FROM audit WHERE action='project.reopen'"));
  }finally{f.cleanup();}
});
test('reports expose exact source records, period movements, advance reservations and safe CSV',()=>{
  const f=fixture();try {
    const a=newAdvance(f);const r=f.erp.report(f.demo.users.manager,f.demo.project,{from:'2026-01-01',to:'2026-12-31'});
    assert.equal(r.totals.actual,'6000.00');assert.equal(r.totals.commitment,'6000.00');assert.equal(r.totals.advance_reservations,'2000.00');assert.equal(r.totals.available,'38000.00');assert.equal(r.totals.cash,'34000.00');assert.equal(r.totals.funding_outstanding,'10000.00');assert.ok(r.ledger.length);assert.ok(r.charges[0].journal_id);assert.ok(r.categories[0].commitment_entries.length);
    const period=f.erp.report(f.demo.users.finance,f.demo.project,{from:'2026-03-01',to:'2026-12-31',category:'Equipment',source_id:f.demo.source});assert.equal(period.period.actual,'0.00');assert.equal(period.period.cash_change,'-2000.00');assert.equal(period.totals.actual,'6000.00');assert.equal(period.advances.find(x=>x.id===a.id).outstanding,'2000.00');
    assert.throws(()=>f.erp.report(f.demo.users.outsider,f.demo.project),/permission denied/);
    const csv=f.erp.reportCSV(f.demo.users.finance,f.demo.project,{to:'2026-12-31'});assert.match(csv,/"Actual|"actual"/);assert.match(csv,/"6000.00"/);assert.match(exportCSV([['=HYPERLINK("evil")']]),/'=HYPERLINK/);
    assert.deepEqual(parseCSV('external_id,date,description,amount\r\nX,2026-01-01,"Quoted, \"\"text\"\"",1.00\r\n')[1],['X','2026-01-01','Quoted, "text"','1.00']);
    assert.deepEqual(parseCSV(exportCSV([['external_id','date','description','amount'],['X','2026-01-01','Quoted, "text"','-1.00']]))[1],['X','2026-01-01','Quoted, "text"','-1.00']);
  }finally{f.cleanup();}
});
test('funding returns and cancelled unreceived promises are distinct auditable movements',()=>{
  const f=fixture();try {
    const promise=f.erp.get('SELECT * FROM promises WHERE source_id=?',f.demo.source);f.op('finance','promise.cancel',{id:promise.id,amount:'10000.00',reference:'CANCEL-UNRECEIVED',date:'2026-03-01',reason:'Award installment withdrawn'});
    f.op('finance','funding.return',{source_id:f.demo.source,account_id:1,amount:'1000.00',reference:'DONOR-RETURN',date:'2026-03-01',reason:'Unused restricted funding returned'});
    const s=f.erp.sourceBalances(f.demo.project)[0];assert.equal(s.promised,4000000);assert.equal(s.received,4000000);assert.equal(s.returned,100000);assert.equal(s.outstanding,0);assert.equal(s.cash,3500000);assert.equal(f.erp.metrics(f.demo.project).actual,600000);
  }finally{f.cleanup();}
});
test('receipt downloads enforce scope and unsupported/invalid attachments cannot be persisted',()=>{
  const f=fixture();try {
    const id=f.spending('10.00',{documents:[receipt()]});const doc=f.erp.documents('request',id)[0];assert.equal(Buffer.from(f.erp.document(f.demo.users.requester,doc.id).content).toString(),'Accepted supporting receipt, reference TEST-001');
    assert.throws(()=>f.erp.document(f.demo.users.outsider,doc.id),/permission denied/);assert.throws(()=>f.spending('10.00',{documents:[{...receipt(),mime:'text/html'}]}),/Only PDF/);assert.throws(()=>f.spending('10.00',{documents:[{...receipt(),filename:'../bad.txt'}]}),/Invalid filename/);
  }finally{f.cleanup();}
});

test('correction of a settled/cancelled advance restores the asset without recreating cancelled spending authority',()=>{
  const f=fixture();try{
    const a=newAdvance(f),accepted=f.op('finance','advance.settle',{advance_id:a.id,request_line_id:a.line,amount:'1500.00',date:'2026-03-03',reference:'CANCELLED-ACCEPT',evidence:'Accepted receipt',documents:[receipt()]});
    f.op('finance','advance.return',{advance_id:a.id,request_line_id:a.line,account_id:1,amount:'500.00',date:'2026-03-03',reference:'CANCELLED-RETURN',evidence:'Unused return'});f.op('manager','request.cancel',{id:a.request,reason:'Fully liquidated'});
    f.op('finance','journal.reverse',{id:accepted.journal_id,reference:'CANCELLED-EXP-REV',date:'2026-03-04',reason:'Supporting expenditure rejected on review'});assert.equal(f.erp.advanceOutstanding(a.request),150000);assert.equal(f.erp.balance(a.line),0);
    f.op('finance','advance.return',{advance_id:a.id,request_line_id:a.line,account_id:1,amount:'1500.00',date:'2026-03-05',reference:'RECOVER-REJECTED',evidence:'Rejected advance expenditure recovered'});assert.equal(f.erp.balance(a.line),0);assert.equal(f.erp.metrics(f.demo.project).actual,600000);assert.equal(f.erp.metrics(f.demo.project).cash,3600000);
  }finally{f.cleanup();}
});
