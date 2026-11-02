import {seal,unseal,fingerprint} from './secure.js';
import {roundedFraction} from './currency.js';

export const SOMALILAND_LAW='https://govsomaliland.org/uploads/files/2026/01/2026-01-21-07-44-12-976-1768981452.pdf';
export function statutoryPolicyMethods({base,fail,text,date,today,cents,decimal,canonical}){
  return {
    submitSomalilandPolicy(actor,d){
      if(!['completed_years','pro_rata_365','manual_review'].includes(d.partial_years)||!Number.isInteger(d.leave_divisor)||d.leave_divisor<1||d.leave_divisor>31||typeof d.gratuity_taxable!=='boolean'||typeof d.leave_taxable!=='boolean')fail('Specify partial-year contract treatment, agreed leave divisor and reviewed tax treatment');
      const doc=base.submitFinalPolicy.call(this,actor,{...d,components:[{name:'Service gratuity',type:'earning',taxable:d.gratuity_taxable},{name:'Unused leave payout',type:'earning',taxable:d.leave_taxable},{name:'Approved notice pay',type:'earning',taxable:true}],allow_advance_recovery:false});
      const formulas={gratuity:'monthly_basic_per_service_year_after_more_than_one_year',partial_years:d.partial_years,leave_divisor:d.leave_divisor,annual_leave_workdays:30,source:SOMALILAND_LAW,articles:['16','23','25'],scope:'Somaliland private-sector employment; signed agreement and organization review required'};
      this.insert('ops_policy_formulas',{document_id:doc.id,jurisdiction:'Somaliland',formulas:JSON.stringify(formulas),agreement:text(d.agreement,'Employer-approved agreement / collective agreement reference',3000)});return doc;
    },
    finalEntitlements(actor,d){
      this.hrRequire(actor,['payroll_preparer','payroll_approver','payroll_finance','hr_staff']);const dep=this.elDoc(d.departure_id,'departure'),policy=this.elDoc(d.policy_id,'final_policy'),row=this.get('SELECT * FROM ops_policy_formulas WHERE document_id=?',policy.id);if(!row)fail('Select a formula-based Somaliland policy');
      const f=JSON.parse(row.formulas),episode=this.employmentEpisodes(dep.employee_id).find(e=>e.departure?.id===dep.id);if(!episode)fail('Departure is not approved for an employment episode');
      const last=new Date(Date.parse(dep.payload.departure_date+'T00:00:00Z')-86400000).toISOString().slice(0,10),e=this.employee(actor,dep.employee_id,last),end=dep.payload.departure_date,start=episode.start_date;
      const anniversary=n=>{const [y,m,day]=start.split('-').map(Number),lastDay=new Date(Date.UTC(y+n,m,0)).getUTCDate();return`${y+n}-${String(m).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;};
      let years=Number(end.slice(0,4))-Number(start.slice(0,4));if(anniversary(years)>end)years--;const overYear=end>anniversary(1),remainingDays=Math.round((Date.parse(end)-Date.parse(anniversary(years)))/86400000),serviceDays=Math.round((Date.parse(end)-Date.parse(start))/86400000),issues=[];
      const monthly=e.terms.pay_basis==='monthly'?cents(e.terms.monthly_salary):cents(d.monthly_equivalent);
      if(e.terms.pay_basis!=='monthly')text(d.equivalent_evidence,'Approved monthly equivalent for open/project contract');
      if(overYear&&remainingDays&&f.partial_years==='manual_review')issues.push('Partial service year requires an explicitly approved contract treatment before calculation');
      const gratuity=overYear?(f.partial_years==='pro_rata_365'?roundedFraction(BigInt(monthly)*BigInt(serviceDays),365n):monthly*years):0;
      const adjustments=[];if(gratuity)adjustments.push({name:'Service gratuity',amount:decimal(gratuity),evidence:`Policy #${policy.id}; episode ${start} to ${end}; ${years} completed years plus ${remainingDays} days; treatment ${f.partial_years}; monthly basic ${decimal(monthly)} USD; ${row.agreement}; Article 25 ${SOMALILAND_LAW}`});
      let leave=null;if(d.leave_enrollment_id){
        const en=this.get('SELECT e.*,p.paid,p.policy_state FROM hr_leave_enrollments e JOIN hr_leave_policies p ON p.id=e.policy_id WHERE e.id=?',d.leave_enrollment_id);
        if(!en||en.employee_id!==dep.employee_id||en.start_date<start||!en.paid||!['validated','demo'].includes(en.policy_state))fail('Select an approved paid-leave entitlement for this employment episode');
        const b=this.leaveBalance(en.id,last),profile=this.hrProfile(dep.employee_id,last),schedule=this.get('SELECT * FROM hr_schedules WHERE id=?',profile.schedule_id),daily=schedule.end_minute-schedule.start_minute-schedule.break_minutes;
        if(b.reserved)issues.push('Resolve pending/future leave reservations before cash-out');if(b.balance<0)issues.push('Negative leave balance requires independent treatment');
        if(b.balance>0&&d.leave_cashout_agreed!==true)issues.push('Employer/employee agreement to leave cash-out must be recorded');
        const amount=b.balance>0?roundedFraction(BigInt(monthly)*BigInt(b.balance),BigInt(f.leave_divisor)*BigInt(daily)):0;
        leave={enrollment_id:en.id,balance_minutes:b.balance,daily_minutes:daily,divisor:f.leave_divisor,amount:decimal(amount)};
        if(amount)adjustments.push({name:'Unused leave payout',amount:decimal(amount),evidence:`Policy #${policy.id}, entitlement #${en.id}, ${b.balance} unused minutes / ${daily} minutes per workday; contractual monthly divisor ${f.leave_divisor}; agreed cash-out ${d.leave_cashout_agreed===true}; Article 16 ${SOMALILAND_LAW}`});
      }else {if(d.leave_reviewed_no_balance!==true)issues.push('Select the leave entitlement or explicitly attest that no payable leave balance remains');if(this.all('SELECT e.id FROM hr_leave_enrollments e JOIN hr_leave_policies p ON p.id=e.policy_id WHERE e.employee_id=? AND e.start_date>=? AND p.paid=1',dep.employee_id,start).some(e=>this.leaveBalance(e.id,last).balance>0))issues.push('A paid-leave balance remains; select its entitlement for reviewed cash-out');}
      if(d.notice_amount&&d.notice_amount!=='0.00')adjustments.push({name:'Approved notice pay',amount:decimal(cents(d.notice_amount)),evidence:text(d.notice_evidence,'Approved notice entitlement and calculation')});
      return{policy_id:policy.id,departure_id:dep.id,jurisdiction:row.jurisdiction,policy_state:policy.payload.policy_state,episode_start:start,last_employed_day:last,service_days:serviceDays,completed_years:years,partial_year_days:remainingDays,monthly_basic:decimal(monthly),leave,adjustments,issues,source:SOMALILAND_LAW,agreement:row.agreement};
    },
    submitFinalPayroll(actor,d){
      if(!this.get('SELECT 1 FROM ops_policy_formulas WHERE document_id=?',d.policy_id||0))return base.submitFinalPayroll.call(this,actor,d);
      const quote=this.finalEntitlements(actor,d),period=this.get('SELECT * FROM hr_periods WHERE id=?',d.period_id||0);if(!period||period.start_date>quote.last_employed_day||period.end_date<quote.last_employed_day)fail('Statutory final period must cover the last employed day');if(quote.issues.length)fail(quote.issues.join('; '));
      if(d.adjustments?.length)fail('Formula policy calculates entitlements from approved source records; use the notice fields for separately authorized notice pay');
      const r=base.submitFinalPayroll.call(this,actor,{...d,adjustments:quote.adjustments});
      const fields=['departure_id','policy_id','leave_enrollment_id','leave_cashout_agreed','leave_reviewed_no_balance','monthly_equivalent','equivalent_evidence','notice_amount','notice_evidence'],inputs=Object.fromEntries(fields.filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));
      this.insert('ops_final_calculations',{request_id:r.final_request_id,inputs_encrypted:seal(this.db,inputs,`ops-final:${r.final_request_id}`),fingerprint:fingerprint(this.db,canonical(quote))});return r;
    },
    reviewExistingFinalPayroll(actor,d){if(this.get('SELECT 1 FROM ops_policy_formulas WHERE document_id=?',d.policy_id||0)){const q=this.finalEntitlements(actor,d);if(q.issues.length)fail(q.issues.join('; '));const run=this.get('SELECT reference,results_encrypted FROM payroll_runs WHERE id=?',d.run_id||0);if(!run)fail('Unknown posted payroll');const result=unseal(this.db,run.results_encrypted,`payroll:${run.reference}`).find(r=>r.employee_id===this.elDoc(d.departure_id).employee_id),actual=result?.evidence?.final_settlement?.adjustments||[];if(q.adjustments.some(a=>!actual.some(x=>x.name===a.name&&x.amount===a.amount)))fail('Existing payroll lacks a calculated final entitlement; prepare the controlled final-pay correction');}return base.reviewExistingFinalPayroll.call(this,actor,d);},
    assertPayrollEvidence(actor,id){base.assertPayrollEvidence.call(this,actor,id);const c=this.get('SELECT c.* FROM ops_final_calculations c JOIN el_final_runs f ON f.request_id=c.request_id WHERE f.run_id=?',id);if(c){const q=this.finalEntitlements(actor,unseal(this.db,c.inputs_encrypted,`ops-final:${c.request_id}`));if(q.issues.length||fingerprint(this.db,canonical(q))!==c.fingerprint)fail('Statutory entitlement evidence changed; prepare a replacement final payroll',409);}},
    lifecycleOverview(actor,filters={}){const r=base.lifecycleOverview.call(this,actor,filters);for(const d of r.documents)if(d.kind==='final_policy'){const p=this.get('SELECT jurisdiction,formulas,agreement FROM ops_policy_formulas WHERE document_id=?',d.id);if(p)d.statutory={...p,formulas:JSON.parse(p.formulas)};}return r;}
  };
}
