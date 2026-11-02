import {seal,unseal} from './secure.js';

// This symbol cannot be supplied through JSON or a payroll form.
const finalContext=Symbol('approved final settlement context');
export function peoplePayrollMethods({base,fail,text,date,cents,parseMoney,decimal,sum}){
  return {
    submitFinalPolicy(actor,d){
      this.elStaff(actor);const start=date(d.start_date),end=date(d.end_date),state=d.policy_state||'provisional';
      if(start>end||!['provisional','demo','validated'].includes(state)||state==='validated'&&!d.validation_reference)fail('A validated final-pay policy needs its authoritative review reference');
      if(!Array.isArray(d.components)||d.components.length>30||new Set(d.components.map(c=>c.name)).size!==d.components.length||typeof d.allow_advance_recovery!=='boolean')fail('Configure unique final-pay components and an explicit recovery policy');
      const components=d.components.map(c=>{if(!['earning','deduction'].includes(c.type)||typeof c.taxable!=='boolean'||c.type==='deduction'&&c.taxable)fail('Choose earning/deduction and explicit tax treatment; manual final deductions are post-tax (taxable:false)');return{name:text(c.name,'Component name',80),type:c.type,taxable:c.taxable};});
      return this.elPrepare(actor,'final_policy',d,{start_date:start,end_date:end,policy_state:state,validation_reference:d.validation_reference||'',components,allow_advance_recovery:d.allow_advance_recovery,reason:text(d.reason,'Final-pay policy authority; no automatic statutory entitlements')});
    },
    approveFinalPolicy(actor,d){this.hrRequire(actor,['payroll_approver']);return this.elApprove(actor,this.elDoc(d.id,'final_policy'));},
    reviewExistingFinalPayroll(actor,d){
      this.hrRequire(actor,['payroll_preparer']);const dep=this.elDoc(d.departure_id,'departure'),policy=this.elDoc(d.policy_id,'final_policy'),run=this.get('SELECT r.*,p.journal_id,c.period_id FROM payroll_runs r JOIN payroll_posts p ON p.run_id=r.id JOIN hr_payroll_context c ON c.run_id=r.id WHERE r.id=?',d.run_id||0),period=run&&this.get('SELECT * FROM hr_periods WHERE id=?',run.period_id);
      if(this.elState(dep)!=='approved'||this.elState(policy)!=='approved'||!['validated','demo'].includes(policy.payload.policy_state)||!run||this.reversed(run.journal_id)||!this.get('SELECT 1 FROM payroll_allocations WHERE run_id=? AND employee_id=?',run.id,dep.employee_id))fail('Review approved final-pay policy, departure and an active posted employee payroll');
      const lastDay=new Date(Date.parse(dep.payload.departure_date+'T00:00:00Z')-86400000).toISOString().slice(0,10);if(period.start_date>lastDay||period.end_date<lastDay||policy.payload.start_date>period.start_date||policy.payload.end_date<period.end_date)fail('Existing payroll must cover the last earned employment day under the final-pay policy');
      if(policy.payload.policy_state==='demo'&&this.all('SELECT project_id FROM payroll_allocations WHERE run_id=? AND employee_id=?',run.id,dep.employee_id).some(l=>!this.get('SELECT demo FROM projects WHERE id=?',l.project_id).demo))fail('Demo final review only applies to demonstration projects');
      return{id:this.insert('el_final_reviews',{departure_id:dep.id,policy_id:policy.id,run_id:run.id,reason:text(d.reason,'Evidence that earned pay, leave and all configured entitlements are already recorded; no additional payroll expense is due',3000),creator_id:actor})};
    },
    approveExistingFinalPayroll(actor,d){this.hrRequire(actor,['payroll_approver']);this.elHiring(actor);const r=this.get('SELECT * FROM el_final_reviews WHERE id=?',d.id||0);if(!r)fail('Unknown existing final payroll review');const dep=this.elDoc(r.departure_id);if(r.creator_id===actor||this.get('SELECT user_id FROM employees WHERE id=?',dep.employee_id).user_id===actor)fail('Independent final-pay reviewer required',403);const p=this.get('SELECT journal_id FROM payroll_posts WHERE run_id=?',r.run_id);if(!p||this.reversed(p.journal_id)||this.elState(this.elDoc(r.policy_id))!=='approved')fail('Final-pay evidence changed; prepare a current review');this.insert('el_final_review_approvals',{review_id:r.id,actor_id:actor});return{id:r.id,additional_expense:'0.00'};},
    elFinalContext(id){
      const r=this.get('SELECT * FROM el_final_requests WHERE id=?',id||0);if(!r)fail('Unknown final-pay request');
      const departure=this.elDoc(r.departure_id,'departure'),policy=this.elDoc(r.policy_id,'final_policy'),period=this.get('SELECT * FROM hr_periods WHERE id=?',r.period_id),p=policy.payload;
      if(this.elState(departure)!=='approved'||this.elState(policy)!=='approved'||!['demo','validated'].includes(p.policy_state))fail('Final payroll requires an approved departure and validated or demonstration policy');
      if(p.start_date>period.start_date||p.end_date<period.end_date||period.start_date>=departure.payload.departure_date)fail('Final period must cover earned employment days and be covered by policy');
      return{request:r,departure,policy,period,payload:unseal(this.db,r.payload_encrypted,`el-final:${r.departure_id}:${r.period_id}`)};
    },
    submitFinalPayroll(actor,d){
      this.hrRequire(actor,['payroll_preparer']);const dep=this.elDoc(d.departure_id,'departure');this.employee(actor,dep.employee_id);
      const adjustments=(d.adjustments||[]).map(c=>({name:text(c.name,'Final component',80),amount:cents(c.amount),evidence:text(c.evidence,'Component calculation / approved entitlement evidence',2000)}));
      if(adjustments.length>30||new Set(adjustments.map(c=>c.name)).size!==adjustments.length)fail('Provide unique bounded final-pay adjustments');
      const request=this.insert('el_final_requests',{departure_id:dep.id,policy_id:d.policy_id,period_id:d.period_id,payload_encrypted:seal(this.db,{adjustments,reason:text(d.reason,'Final payroll review and leave treatment')},`el-final:${dep.id}:${d.period_id}`),creator_id:actor});
      const ctx=this.elFinalContext(request);for(const a of adjustments)if(!ctx.policy.payload.components.some(c=>c.name===a.name))fail('Final component is not authorized by the approved policy');
      if(d.advance_recoveries?.length&&!ctx.policy.payload.allow_advance_recovery)fail('Final-pay policy does not authorize salary advance recovery');
      const input={reference:d.reference,period_id:d.period_id,rule_id:d.rule_id,final_request_id:request,...(d.replaces_id?{replaces_id:d.replaces_id}:{}),employees:[{employee_id:dep.employee_id,basis:d.basis||'fixed',allocation_plan_id:d.allocation_plan_id||null,...(d.gross_pay!==undefined?{gross_pay:d.gross_pay}:{}),advance_recoveries:d.advance_recoveries||[]}]};
      const result=base.submitManagedPayroll.call(this,actor,input);this.insert('el_final_runs',{request_id:request,run_id:result.id});return{...result,final_request_id:request};
    },
    submitManagedPayroll(actor,d){if(d.final_request_id)fail('Use the controlled final-payroll workflow');return base.submitManagedPayroll.call(this,actor,d);},
    submitPayroll(actor,d){for(const e of d.employees||[]){const dep=this.lifecycleDeparture(e.employee_id);if(dep&&d.period>=dep.payload.departure_date.slice(0,7))fail('Departed employees require the controlled final-payroll workflow');}return base.submitPayroll.call(this,actor,d);},
    managedPayrollBuild(actor,d){
      const period=this.get('SELECT * FROM hr_periods WHERE id=?',d.period_id||0),ctx=d.final_request_id?this.elFinalContext(d.final_request_id):null;
      if(ctx&&(ctx.request.period_id!==d.period_id||d.employees?.length!==1||d.employees[0].employee_id!==ctx.departure.employee_id))fail('Final-pay input does not match its immutable settlement request');
      const employees=(d.employees||[]).map(item=>{const dep=this.lifecycleDeparture(item.employee_id);if(!ctx&&dep&&period?.start_date>=dep.payload.departure_date)fail('Ordinary payroll excludes departed employees; use final payroll for earned balances');return{...item,...(ctx?{[finalContext]:ctx}:{})};});
      const result=base.managedPayrollBuild.call(this,actor,{...d,employees});
      if(ctx?.policy.payload.policy_state==='demo'&&result.rows.some(l=>!this.get('SELECT demo FROM projects WHERE id=?',l.project_id).demo))fail('Demonstration final-pay policy may only charge demonstration projects');
      return result;
    },
    managedSalary(actor,employee,period,rules,item){
      const r=base.managedSalary.call(this,actor,employee,period,rules,item),ctx=item[finalContext];if(!ctx)return r;
      const configured=ctx.policy.payload.components,adjustments=ctx.payload.adjustments.map(a=>({...a,...configured.find(c=>c.name===a.name)}));
      const earning=sum(adjustments.filter(a=>a.type==='earning').map(a=>a.amount)),deduction=sum(adjustments.filter(a=>a.type==='deduction').map(a=>a.amount));
      const taxable=parseMoney(r.evidence.taxable_pay,{zero:true})+sum(adjustments.filter(a=>a.type==='earning'&&a.taxable).map(a=>a.amount)),oldTax=this.payrollCalculation(parseMoney(r.evidence.taxable_pay,{zero:true}),rules),tax=this.payrollCalculation(taxable,rules);
      const gross=r.calc.gross+earning,employer=r.calc.employer-oldTax.employer+tax.employer,withholding=tax.withholding,net=r.calc.net+earning-deduction-(withholding-r.calc.withholding);
      if(net<0)fail('Final deductions exceed earned net pay');
      r.calc={gross,employer,withholding,net,cost:sum([gross,employer]),tax:sum([tax.withholding,tax.employer,r.controls.other,deduction])};
      r.controls={statutory:tax.withholding+tax.employer,other:r.controls.other+deduction};
      r.evidence={...r.evidence,taxable_pay:decimal(taxable),final_settlement:{request_id:ctx.request.id,departure_id:ctx.departure.id,policy_id:ctx.policy.id,policy:ctx.policy.payload,adjustments:adjustments.map(a=>({...a,amount:decimal(a.amount)})),reason:ctx.payload.reason}};
      r.components=[...new Set([...r.components,...adjustments.map(a=>a.name)])];return r;
    }
  };
}
