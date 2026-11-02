import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.js';
import {lifecycleSetup} from '../src/people-demo.js';
import {unseal} from '../src/secure.js';
import {verifySMTP} from '../src/transport.js';

test('closed employee retention erases private records while preserving posted salary, payments and financial identity',t=>{
  const f=fixture();try{
    const s=lifecycleSetup(f),file=f.op('admin','hr.document',{employee_id:s.employee,filename:'private-identity.txt',mime:'text/plain',content:Buffer.from('REMOVE PRIVATE IDENTITY').toString('base64'),visibility:'hr'}).id;
    const cycle=f.op('admin','el.review.cycle',{name:'Final review',start_date:'2026-03-01',end_date:'2026-03-31',due_date:'2026-04-01',min_rating:1,max_rating:5,criteria:s.criteria}).id;
    const review=f.op('manager','el.review.create',{employee_id:s.employee,cycle_id:cycle,goals:[{goal:'Private review goal',measure:'Complete',due_date:'2026-03-31'}]}).id,ratings=[{name:'Role competence',rating:4},{name:'Project judgment',rating:5}];
    f.op('requester','el.review.step',{id:review,kind:'self',comment:'Private employee feedback',ratings});f.op('manager','el.review.step',{id:review,kind:'supervisor',comment:'Private supervisor feedback',ratings});f.op('admin','el.review.step',{id:review,kind:'finalize',comment:'Independent moderation'});
    const policy=f.op('admin','el.final.policy',{reference:'RET-FINAL',start_date:'2026-01-01',end_date:'2026-12-31',policy_state:'demo',components:[],allow_advance_recovery:false,reason:'Explicit isolated test policy'}).id;f.op('manager','el.final.policy.approve',{id:policy});
    const dep=f.op('admin','el.departure.submit',{reference:'RET-DEPARTURE',employee_id:s.employee,template_id:s.departureTemplate,departure_date:'2026-04-01',type:'resignation',reason:'Reviewed test notice'}).id;f.op('manager','el.departure.approve',{id:dep});
    const run=f.op('finance','el.final.payroll',{departure_id:dep,policy_id:policy,period_id:s.period,rule_id:s.rule,allocation_plan_id:s.plan,reference:'RET-PAY',reason:'Final earned salary reviewed'}).id;f.op('manager','payroll.approve',{id:run});f.op('finance','payroll.post',{id:run});
    const voucher=f.op('finance','voucher.submit',{target_kind:'payroll_net',target_id:run,amount:'1000.00',account_id:1,date:'2026-04-01',reference:'RET-PAYMENT'}).id;f.op('manager','voucher.approve',{id:voucher});f.op('finance','voucher.post',{id:voucher});
    for(const task of f.erp.all('SELECT t.id FROM el_tasks t JOIN el_cases c ON c.id=t.case_id WHERE c.document_id=?',dep))f.op('admin','el.task',{id:task.id,evidence:'Clearance completed'});
    f.op('admin','el.departure.close',{id:dep,reason:'All obligations settled and verified'});
    f.op('admin','ops.role',{user_id:f.demo.users.manager,role:'privacy_officer',enabled:true});
    for(const kind of ['review','employee_document','employment']){const id=f.op('admin','ops.retention.submit',{kind,days:1,effective_date:'2026-01-01',automatic:true,legal_basis:'Isolated test deletion authority retaining financial identity'}).id;f.op('manager','ops.retention.approve',{id});}
    const before=f.erp.metrics(f.demo.project),slip=f.erp.payslip(f.demo.users.admin,run,s.employee);
    t.mock.timers.enable({apis:['Date'],now:Date.UTC(2030,0,1)});
    assert.equal(f.erp.retentionCandidates(f.demo.users.manager).filter(x=>x.eligible).length,3);
    f.op('admin','ops.retention.run',{dry_run:false});
    assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM ops_erasures').n,3);assert.deepEqual(f.erp.metrics(f.demo.project),before);assert.deepEqual(f.erp.payslip(f.demo.users.admin,run,s.employee),slip);
    assert.throws(()=>f.erp.hrDocument(f.demo.users.admin,file),e=>e.status===410);assert.throws(()=>f.erp.hrDocument(f.demo.users.outsider,file),e=>e.status===403);
    assert.equal(f.erp.get('SELECT goals FROM el_reviews WHERE id=?',review).goals,'[]');assert.deepEqual(unseal(f.db,f.erp.hrProfile(s.employee).private_encrypted,`hr-profile:${s.employee}:${f.erp.hrProfile(s.employee).effective_date}`).contact,{});assert.doesNotThrow(()=>f.erp.lifecycleOverview(f.demo.users.admin));
  }finally{t.mock.timers.reset();f.cleanup();}
});

test('SMTP probes authenticate without sending and reject unauthorized verification or arbitrary secret references',async()=>{
  const f=fixture();try{let verified=0,sent=0,closed=0;const transport={verify:async()=>{verified++;},sendMail:async()=>{sent++;},close:()=>{closed++;}};
    await assert.rejects(()=>verifySMTP(f.erp,f.demo.users.requester,{smtpTransport:transport}),/Administrator/);
    const result=await verifySMTP(f.erp,f.demo.users.admin,{smtpTransport:transport});assert.equal(result.ok,true);assert.equal(verified,1);assert.equal(sent,0);assert.equal(closed,1);
    assert.throws(()=>f.op('admin','ops.provider.configure',{kind:'scim',name:'Bad secret reference',endpoint:'https://provider.test/scim',token_env:'ERP_MASTER_KEY',enabled:true}),/scoped/);
  }finally{f.cleanup();}
});
