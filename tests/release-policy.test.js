import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.js';
import {lifecycleSetup} from '../src/people-demo.js';

test('a salary-only final review cannot be approved or clear departure after new leave evidence arrives',()=>{for(const approveFirst of [false,true]){const f=fixture();try{
  const s=lifecycleSetup(f),run=f.op('finance','hr.payroll.submit',s.input).id;f.op('manager','payroll.approve',{id:run});f.op('finance','payroll.post',{id:run});
  const policy=f.op('admin','ops.policy.somaliland',{reference:'RELEASE-FINAL-POLICY',start_date:'2026-01-01',end_date:'2026-12-31',policy_state:'demo',partial_years:'completed_years',leave_divisor:26,gratuity_taxable:true,leave_taxable:true,agreement:'Isolated acceptance agreement; no statutory signoff asserted',reason:'Test independently reviewed final-pay evidence'}).id;f.op('manager','el.final.policy.approve',{id:policy});
  const dep=f.op('admin','el.departure.submit',{reference:'RELEASE-END',employee_id:s.employee,template_id:s.departureTemplate,departure_date:'2026-04-01',type:'resignation',reason:'Test final-day review'}).id;f.op('manager','el.departure.approve',{id:dep});
  const review=f.op('finance','el.final.review',{departure_id:dep,policy_id:policy,run_id:run,leave_reviewed_no_balance:true,reason:'No additional entitlements recorded at review time'}).id;if(approveFirst)f.op('manager','el.final.review.approve',{id:review});
  const lp=f.op('admin','hr.leave.policy',{name:'Previously omitted entitlement',start_date:'2026-01-01',end_date:'2026-12-31',paid:true,opening_minutes:480,monthly_minutes:0,carryover_cap:480,expiry_months:12,eligibility_days:0,policy_state:'demo',reason:'Late supporting evidence requires correction'}).id;f.op('manager','hr.leave.policy.approve',{id:lp});f.op('admin','hr.leave.enroll',{employee_id:s.employee,policy_id:lp,start_date:'2026-03-01'});
  if(!approveFirst)assert.throws(()=>f.op('manager','el.final.review.approve',{id:review}),/entitlement evidence changed/);else assert.ok(f.erp.departureClearance(f.demo.users.admin,dep).blockers.some(x=>x.key==='stale-final-review'));
  assert.equal(f.erp.metrics(f.demo.project).actual,700000);assert.throws(()=>f.erp.run("UPDATE release_final_review_evidence SET fingerprint='bypass'"),/Immutable/);
}finally{f.cleanup();}}});
