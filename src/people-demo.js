import {randomUUID} from 'node:crypto';
import {seedDemo} from './demo.js';
import {ERP} from './service.js';

// Only used by isolated acceptance fixtures and the explicit empty-database demo.
export function lifecycleSetup(f,{convert=true}={}){
  const {op,erp,demo}=f;
  op('admin','hr.role',{user_id:demo.users.manager,role:'supervisor',enabled:true});
  op('admin','el.role',{user_id:demo.users.manager,role:'hiring_approver',enabled:true});
  op('admin','el.role',{user_id:demo.users.admin,role:'review_moderator',enabled:true});
  const schedule=op('admin','hr.schedule',{name:'Lifecycle demonstration calendar',weekdays:[1,2,3,4,5],start_time:'08:00',end_time:'16:00',break_minutes:0}).id;
  const template=(kind,items)=>op('admin','el.template',{kind,name:kind+' demonstration checklist',items}).id;
  const onboarding=template('onboarding',[{title:'Contract and identity verification',kind:'contract',owner:'employee',offset_days:0,requires_review:true},{title:'Orientation and policy acknowledgment',kind:'orientation',owner:'employee',offset_days:7,requires_review:true}]);
  const departureTemplate=template('departure',[{title:'Handover and leave/final-pay review',kind:'handover',owner:'hr',offset_days:0,requires_review:false}]);
  const lines=[{project_id:demo.project,source_id:demo.source,category:'Equipment',activity:'Outreach',amount:'12000.00'}],criteria=[{name:'Role competence',weight:'60'},{name:'Project judgment',weight:'40'}];
  const staffing=op('admin','el.staffing.submit',{reference:'LIFE-STAFF',date:'2026-02-10',department:'Programs',position:'Project officer',supervisor_id:demo.users.manager,location:'Mogadishu',employment_type:'project',start_date:'2026-03-01',compensation_min:'800.00',compensation_max:'1200.00',lines,criteria,reason:'Full annual estimated employer cost; demonstration only'}).id;
  op('finance','el.staffing.review',{id:staffing,reason:'Available funding and full employer-cost forecast reviewed'});op('manager','el.staffing.approve',{id:staffing});
  const vacancy=op('admin','el.vacancy',{staffing_id:staffing,reference:'LIFE-VACANCY'}).id;
  const candidate=op('admin','el.candidate',{code:'LIFE-CANDIDATE',name:'Lifecycle Example Employee',email:'candidate@lifecycle.test',user_id:demo.users.requester}).id;
  const application=op('admin','el.application',{vacancy_id:vacancy,candidate_id:candidate}).id;
  const interview=op('admin','el.interview',{application_id:application,panel_id:demo.users.manager,start_at:'2026-02-12T09:00:00+03:00',end_at:'2026-02-12T10:00:00+03:00',location:'Office interview'}).id;
  op('manager','el.interview.score',{id:interview,ratings:[{name:'Role competence',rating:4},{name:'Project judgment',rating:5}],feedback:'Evidence-backed demonstration scorecard'});
  op('manager','el.hiring.decision',{application_id:application,decision:'selected',reason:'Panel assessment and role fit reviewed'});
  const offer=op('admin','el.offer.submit',{reference:'LIFE-OFFER',date:'2026-02-14',application_id:application,start_date:'2026-03-01',pay_basis:'monthly',monthly_salary:'1000.00',probation_due:'2026-03-31',reason:'Approved role range; demonstration contract'}).id;
  op('manager','el.offer.approve',{id:offer});op('requester','el.offer.response',{id:offer,response:'accepted',evidence:'Candidate accepted demonstration offer'});
  const s={schedule,onboarding,departureTemplate,staffing,vacancy,candidate,application,interview,offer,lines,criteria};if(!convert)return s;
  const employee=op('admin','el.candidate.convert',{offer_id:offer,employee_code:'LIFE-EMP',schedule_id:schedule,template_id:onboarding}).id;
  const period=op('admin','hr.period',{code:'LIFE-MARCH',start_date:'2026-03-01',end_date:'2026-03-31',posting_date:'2026-03-31'}).id;
  const rule=op('admin','payroll.rule',{jurisdiction:'Demonstration only, no statutory rates',demo:true,start_date:'2026-01-01',end_date:'2026-12-31',reason:'Explicit zero test rates; no production policy claimed',rules:{brackets:[{up_to:null,rate:'0'}],employer_rate:'0',fixed_withholding:'0.00'}}).id;op('manager','payroll.rule.approve',{id:rule});
  const plan=op('finance','hr.allocation.submit',{employee_id:employee,start_date:'2026-03-01',end_date:'2026-12-31',reference:'LIFE-PLAN',reason:'Approved full project allocation',lines:[{...lines[0],percent:'100'}]}).id;op('manager','hr.allocation.approve',{id:plan});
  const input={period_id:period,rule_id:rule,reference:'LIFE-MARCH-PAY',employees:[{employee_id:employee,allocation_plan_id:plan}]};return{...s,employee,period,rule,plan,input};
}

export function seedPeople(db){const demo=seedDemo(db),erp=new ERP(db),op=(role,action,data)=>erp.execute(demo.users[role],action,data,randomUUID()),s=lifecycleSetup({op,erp,demo});return{...demo,lifecycle:s};}
