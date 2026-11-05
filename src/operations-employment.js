import {seal,unseal} from './secure.js';

export function operationsEmploymentMethods({base,fail,text,date,today,decimal,cents,parseMoney,sum}){
  return {
    opsPrivacy(actor){return this.roleAssignments(actor).some(r=>r.area==='operations'&&r.role==='privacy_officer');},
    setOperationsRole(actor,d){this.admin(actor);this.user(d.user_id);if(d.role!=='privacy_officer'||typeof d.enabled!=='boolean')fail('Choose privacy officer and explicit enabled state');if(d.enabled)this.run('INSERT OR IGNORE INTO ops_roles(user_id,role) VALUES(?,?)',d.user_id,d.role);else this.run('DELETE FROM ops_roles WHERE user_id=? AND role=?',d.user_id,d.role);return{id:d.user_id};},
    configureOperations(actor,d){
      this.admin(actor);for(const key of ['hr_user','hiring_user','payroll_preparer','payroll_approver','finance_user','moderator_user','access_user'])this.user(d[key]);
      if(d.hiring_user===d.hr_user||d.payroll_preparer===d.payroll_approver||d.moderator_user===d.hiring_user)fail('Separate HR/hiring, payroll preparation/approval and performance moderation');
      const grants=[['hr_user','hr','hr_staff'],['hiring_user','el','hiring_approver'],['hiring_user','hr','supervisor'],['payroll_preparer','hr','payroll_preparer'],['payroll_approver','hr','payroll_approver'],['finance_user','hr','payroll_finance'],['moderator_user','el','review_moderator'],['access_user','el','access_officer']];
      for(const[key,scope,role]of grants)this[scope==='hr'?'setHRRole':'setLifecycleRole'](actor,{user_id:d[key],role,enabled:true});
      this.setOperationsRole(actor,{user_id:d.privacy_user||d.hiring_user,role:'privacy_officer',enabled:true});
      for(const kind of ['staffing','offer','training','change','departure','final_policy'])this.setLifecyclePolicy(actor,{kind,levels:[['hiring']],reason:d.reason});
      const id=this.insert('ops_setup_runs',{configuration:JSON.stringify(Object.fromEntries(Object.keys(d).filter(k=>k!=='reason').map(k=>[k,d[k]]))),reason:text(d.reason,'Approval setup authority'),actor_id:actor});return{id};
    },
    // Each approval is authorized by the frozen level, rather than a hidden extra role.
    elApprove(actor,doc,projects=[]){
      const prior=this.all('SELECT actor_id FROM work_approvals WHERE kind=? AND document_id=?','el_'+doc.kind,doc.id),roles=JSON.parse(doc.approval_policy)[prior.length]||[];
      if(!roles.some(r=>this.workOrgEligible(actor,r,'el_'+doc.kind))&&!projects.some(p=>roles.includes(this.get('SELECT role FROM memberships WHERE project_id=? AND user_id=?',p,actor)?.role)))fail('Lifecycle approval capability required',403);
      if(this.elState(doc)!=='pending')fail('Choose a pending lifecycle document');
      if(doc.employee_id&&this.get('SELECT user_id FROM employees WHERE id=?',doc.employee_id)?.user_id===actor)fail('Employees cannot approve their own employment actions',403);
      return{id:doc.id,approved:this.workApprove(actor,'el_'+doc.kind,doc,[...new Set(projects)])};
    },
    employmentEpisodes(employee){
      const e=this.get('SELECT start_date FROM employees WHERE id=?',employee||0);if(!e)fail('Unknown employee');
      const starts=[{start_date:e.start_date,rehire_id:null},...this.all('SELECT start_date,document_id AS rehire_id FROM ops_rehires WHERE employee_id=? ORDER BY start_date',employee)];
      const departures=this.all("SELECT id FROM el_documents WHERE kind='departure' AND employee_id=? ORDER BY id",employee).map(r=>this.elDoc(r.id)).filter(d=>this.elState(d)==='approved');
      return starts.map(s=>({...s,departure:departures.filter(d=>d.payload.departure_date>s.start_date).sort((a,b)=>a.payload.departure_date.localeCompare(b.payload.departure_date))[0]||null}));
    },
    lifecycleDeparture(employee){const e=this.employmentEpisodes(employee).at(-1);return e?.departure||null;},
    hrProfile(id,dt=today()){
      // The underlying effective profile already records old departures and new starts.
      const p=base.hrProfile.call(this,id,dt);if(!p)return p;
      const episode=this.employmentEpisodes(id).filter(e=>e.start_date<=dt).at(-1);return episode?.departure&&dt>=episode.departure.payload.departure_date?{...p,status:'departed'}:p;
    },
    submitRehire(actor,d){
      this.elStaff(actor);const e=this.hrEmployee(actor,d.employee_id,{privateData:true}),dep=this.lifecycleDeparture(e.id),start=date(d.start_date);
      if(!dep||this.elState(dep)!=='approved'||start<=dep.payload.departure_date)fail('Rehire must follow an approved departure with a distinct new start date');
      this.hrEvidenceMutable(e.id,start,'9999-12-31');const old=this.elProfilePayload(e.id,dep.payload.departure_date),latest=this.get('SELECT id FROM hr_profiles WHERE employee_id=? ORDER BY effective_date DESC,id DESC LIMIT 1',e.id);
      const previous=this.get('SELECT t.id,t.effective_date FROM employee_terms t JOIN employee_term_approvals a ON a.term_id=t.id WHERE t.employee_id=? ORDER BY t.effective_date DESC,t.id DESC LIMIT 1',e.id);
      if(previous&&start<=previous.effective_date)fail('New employment terms must follow existing approved versions');
      if(typeof d.enable_access!=='boolean')fail('Specify whether approved local access should resume; old role assignments are never restored');
      const term=this.insert('employee_terms',{employee_id:e.id,previous_id:previous?.id||null,effective_date:start,terms_encrypted:seal(this.db,this.compensationTerms(d.terms||{},start),`employee-terms:${e.id}:${start}`),reason:text(d.reason,'New employment agreement'),creator_id:actor});
      const doc=this.elPrepare(actor,'rehire',{...d,employee_id:e.id},{departure_id:dep.id,start_date:start,term_id:term,previous_profile_id:latest.id,enable_access:d.enable_access,template_id:d.template_id||null,profile:{...old,effective_date:start,status:'active',department:d.department||old.department,position:d.position||old.position,location:d.location||old.location,schedule_id:d.schedule_id||old.schedule_id,supervisor_id:d.supervisor_id||old.supervisor_id},reason:d.reason});
      this.insert('ops_rehire_proposals',{document_id:doc.id,departure_id:dep.id,term_id:term});return doc;
    },
    approveEmployeeTerms(actor,d){if(this.get('SELECT 1 FROM ops_rehire_proposals WHERE term_id=?',d.id||0))fail('Approve the linked rehire before applying new employment terms');return base.approveEmployeeTerms.call(this,actor,d);},
    approveRehire(actor,d){
      const doc=this.elDoc(d.id,'rehire'),p=doc.payload,latest=this.get('SELECT id FROM hr_profiles WHERE employee_id=? ORDER BY effective_date DESC,id DESC LIMIT 1',doc.employee_id);
      if(latest?.id!==p.previous_profile_id||this.lifecycleDeparture(doc.employee_id)?.id!==p.departure_id)fail('Rehire evidence changed; prepare a current agreement',409);
      this.hrEvidenceMutable(doc.employee_id,p.start_date,'9999-12-31');const result=this.elApprove(actor,doc);
      if(result.approved){this.hrRequire(actor,['payroll_approver']);base.approveEmployeeTerms.call(this,actor,{id:p.term_id});const profile=this.elApplyProfile(actor,doc.employee_id,p.profile,p.reason);
        this.insert('ops_rehires',{document_id:doc.id,departure_id:p.departure_id,employee_id:doc.employee_id,start_date:p.start_date,profile_id:profile,access_enabled:p.enable_access?1:0});
        const user=this.get('SELECT user_id FROM employees WHERE id=?',doc.employee_id).user_id;if(user){this.run('DELETE FROM sessions WHERE user_id=?',user);this.run('UPDATE users SET admin=0 WHERE id=?',user);for(const table of ['memberships','org_roles','hr_roles','acc_roles','el_roles','ops_roles'])this.run(`DELETE FROM ${table} WHERE user_id=?`,user);}
        if(p.template_id){const owner=this.hasHR(actor,'hr_staff')?actor:doc.creator_id;this.startLifecycleCase(owner,{employee_id:doc.employee_id,template_id:p.template_id,start_date:p.start_date});}
      }return result;
    },
    lifecycleBlockedUser(user){
      for(const e of this.all('SELECT id FROM employees WHERE user_id=?',user)){
        const episodes=this.employmentEpisodes(e.id),current=episodes.at(-1),rehire=current.rehire_id&&this.get('SELECT * FROM ops_rehires WHERE document_id=?',current.rehire_id);
        if(rehire&&(rehire.start_date>today()||!rehire.access_enabled))return{employee:e.id,departure:episodes.at(-2).departure};
        if(current.departure&&current.departure.payload.revocation_date<=today())return{employee:e.id,departure:current.departure};
      }return null;
    },
    revokeDueLifecycleAccess(){base.revokeDueLifecycleAccess.call(this);for(const e of this.all('SELECT id,user_id FROM employees WHERE user_id IS NOT NULL')){const blocked=this.lifecycleBlockedUser(e.user_id);if(blocked&&!this.get('SELECT 1 FROM ops_revocations WHERE departure_id=?',blocked.departure.id))this.insert('ops_revocations',{departure_id:blocked.departure.id,employee_id:e.id,user_id:e.user_id,date:today()});}},
    leaveBalance(id,asOf=today()){const en=this.get('SELECT employee_id,start_date FROM hr_leave_enrollments WHERE id=?',id||0);const episode=en&&this.employmentEpisodes(en.employee_id).filter(e=>e.start_date<=en.start_date).at(-1),cutoff=episode?.departure?new Date(Date.parse(episode.departure.payload.departure_date+'T00:00:00Z')-86400000).toISOString().slice(0,10):null;const r=base.leaveBalance.call(this,id,cutoff&&cutoff<asOf?cutoff:asOf);return{...r,employment_cutoff:cutoff,requested_as_of:asOf};},
    cancelLifecycleDocument(actor,d){if(this.get('SELECT 1 FROM ops_rehires WHERE document_id=?',d.id||0))fail('Applied employment episode is immutable; record a new departure');return base.cancelLifecycleDocument.call(this,actor,d);},
    managedPayrollBuild(actor,d){if(d.final_request_id){const ctx=this.elFinalContext(d.final_request_id),episode=this.employmentEpisodes(ctx.departure.employee_id).find(e=>e.departure?.id===ctx.departure.id);if(!episode||ctx.period.start_date<episode.start_date)fail('Final payroll must stay inside the linked employment episode');}if(!d.final_request_id){const period=this.get('SELECT * FROM hr_periods WHERE id=?',d.period_id||0);for(const item of d.employees||[]){const episode=this.employmentEpisodes(item.employee_id).filter(e=>e.start_date<=period?.end_date).at(-1);if(episode?.rehire_id&&item.basis!=='timesheet'){const plan=this.get('SELECT start_date FROM hr_allocation_plans WHERE id=?',item.allocation_plan_id||0);if(plan&&plan.start_date<episode.start_date)fail('Approve a new allocation plan for the rehire episode');}}}return base.managedPayrollBuild.call(this,actor,d);},
    assignLifecycleEquipment(actor,d){if(this.hrProfile(d.employee_id,d.date)?.status==='departed')fail('Equipment issue requires an active approved employment episode');return base.assignLifecycleEquipment.call(this,actor,d);},
    submitSelfChange(actor,d){const current=this.employmentEpisodes(d.employee_id).at(-1);if(d.effective_date<current.start_date)fail('Self-service changes must belong to the current employment episode');return base.submitSelfChange.call(this,actor,d);},
    lifecycleOverview(actor,filters={}){const r=base.lifecycleOverview.call(this,actor,filters);r.employment_episodes=r.employees.map(e=>({employee_id:e.id,episodes:this.employmentEpisodes(e.id).map(x=>({start_date:x.start_date,rehire_id:x.rehire_id,departure_id:x.departure?.id||null,end_date:x.departure?.payload.departure_date||null}))}));return r;}
  };
}
