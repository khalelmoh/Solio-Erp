import {seal,unseal} from './secure.js';
import {retentionColumns} from './retention-schema.js';

export function retentionMethods({base,fail,text,date,today,hash}){
  return {
    submitRetentionRule(actor,d){this.admin(actor);if(!['candidate','review','employee_document','employment'].includes(d.kind)||!Number.isInteger(d.days)||d.days<1||d.days>36500||typeof d.automatic!=='boolean')fail('Choose a supported record class, 1–36500 days and explicit automation');return{id:this.insert('ops_retention_rules',{kind:d.kind,days:d.days,effective_date:date(d.effective_date),legal_basis:text(d.legal_basis,'Retention and deletion authority, including retained financial exceptions',3000),automatic:d.automatic?1:0,creator_id:actor})};},
    approveRetentionRule(actor,d){if(!this.opsPrivacy(actor))this.elStaff(actor);const p=this.get('SELECT * FROM ops_retention_rules WHERE id=?',d.id||0);if(!p||p.creator_id===actor)fail('Independent HR review of retention/deletion authority required',403);this.insert('ops_retention_approvals',{rule_id:p.id,actor_id:actor});return{id:p.id};},
    setRetentionHold(actor,d){if(!this.opsPrivacy(actor))this.elStaff(actor);if(!['candidate','review','employee_document','employment'].includes(d.kind)||!Number.isInteger(d.record_id)||typeof d.enabled!=='boolean')fail('Choose record class, source ID and explicit hold state');const table={candidate:'el_candidates',review:'el_reviews',employee_document:'hr_documents',employment:'employees'}[d.kind];if(!this.get(`SELECT 1 FROM ${table} WHERE id=?`,d.record_id))fail('Unknown retention source');return{id:this.insert('ops_holds',{kind:d.kind,record_id:d.record_id,enabled:d.enabled?1:0,reason:text(d.reason,'Legal hold / release authority'),actor_id:actor})};},
    retentionErased(kind,id){const generation=kind==='employment'?(this.employmentEpisodes(id).at(-1).rehire_id||0):0;return!!this.get('SELECT 1 FROM ops_erasures WHERE kind=? AND record_id=? AND generation=?',kind,id,generation);},
    retentionCandidates(actor){
      if(!this.user(actor).admin&&!this.opsPrivacy(actor))this.elStaff(actor);const result=[],dt=today();
      for(const kind of ['candidate','review','employee_document','employment']){
        const rule=this.get('SELECT r.* FROM ops_retention_rules r JOIN ops_retention_approvals a ON a.rule_id=r.id WHERE r.kind=? AND r.effective_date<=? ORDER BY r.id DESC LIMIT 1',kind,dt);if(!rule)continue;
        const table={candidate:'el_candidates',review:'el_reviews',employee_document:'hr_documents',employment:'employees'}[kind];
        for(const row of this.all(`SELECT * FROM ${table}`)){
          if(this.retentionErased(kind,row.id))continue;let anchor,blocked='';
          if(kind==='candidate'){
            anchor=this.get("SELECT created_at FROM audit WHERE action='el.candidate' AND entity=? ORDER BY id LIMIT 1",String(row.id))?.created_at;
            if(this.get('SELECT 1 FROM el_conversions WHERE candidate_id=?',row.id))blocked='Converted employment/financial history requires its separate retention authority';
            for(const job of this.retentionCalendarJobs(row.id)){if(job.state==='sending'||job.attempts>0&&!this.get("SELECT 1 FROM ops_provider_jobs WHERE event_key=? AND state='sent'",'cancel:'+job.event_key))blocked||='Calendar copy requires confirmed provider cancellation';}
            for(const a of this.all('SELECT id FROM el_applications WHERE candidate_id=?',row.id)){
              if(this.get('SELECT decision FROM el_hiring_decisions WHERE application_id=? ORDER BY id DESC LIMIT 1',a.id)?.decision!=='rejected')blocked||='Application is not finally rejected';
              if(this.all('SELECT document_id FROM el_offer_links WHERE application_id=?',a.id).some(l=>!['rejected','withdrawn'].includes(this.elState(this.elDoc(l.document_id)))))blocked||='Live offer remains';
            }
          }
          if(kind==='review'){
            const cycle=this.get('SELECT end_date FROM el_review_cycles WHERE id=?',row.cycle_id);anchor=cycle.end_date;
            if(!this.get("SELECT 1 FROM el_review_events WHERE review_id=? AND kind='finalize'",row.id))blocked='Review not finalized';
            const dep=this.lifecycleDeparture(row.employee_id);if(!dep||!this.get('SELECT 1 FROM el_departure_closures WHERE document_id=?',dep.id)||!this.departureClearance(actor,dep.id,{retentionCheck:true}).ready)blocked='Employee is active or clearance is unresolved';
          }
          if(kind==='employee_document'||kind==='employment'){
            const employee=kind==='employment'?row.id:row.employee_id,dep=this.lifecycleDeparture(employee);anchor=dep?.payload.departure_date;
            if(!dep||dep.payload.departure_date>dt||!this.get('SELECT 1 FROM el_departure_closures WHERE document_id=?',dep.id)||!this.departureClearance(actor,dep.id,{retentionCheck:true}).ready)blocked='Employee is active or clearance is unresolved';
            if(kind==='employee_document'&&row.expiry&&(!anchor||row.expiry>anchor))anchor=row.expiry;
          }
          const global=this.get('SELECT legal_hold FROM el_retention_policies WHERE kind=? ORDER BY id DESC LIMIT 1',kind)?.legal_hold,hold=this.get('SELECT enabled FROM ops_holds WHERE kind=? AND record_id=? ORDER BY id DESC LIMIT 1',kind,row.id)?.enabled;
          if(global||hold)blocked='Legal hold';if(!anchor)blocked||='Unknown record date; manual investigation required';
          const due=anchor?new Date(Date.parse(anchor.slice(0,10)+'T00:00:00Z')+rule.days*86400000).toISOString().slice(0,10):null;
          result.push({kind,record_id:row.id,generation:kind==='employment'?(this.employmentEpisodes(row.id).at(-1).rehire_id||0):0,rule_id:rule.id,due_date:due,automatic:!!rule.automatic,blocked,eligible:!blocked&&due<=dt});
        }
      }return result;
    },
    retentionCalendarJobs(candidate){const interviews=new Set(this.all('SELECT i.id FROM el_interviews i JOIN el_applications a ON a.id=i.application_id WHERE a.candidate_id=?',candidate).map(i=>i.id));return this.all("SELECT * FROM ops_provider_jobs WHERE kind='calendar' AND payload_encrypted<>''").filter(j=>interviews.has(unseal(this.db,j.payload_encrypted,`ops-job:${j.event_key}`).interview_id));},
    retentionWrite(run,table,id,values){
      if(!this.db.isTransaction||!retentionColumns[table]||Object.keys(values).some(k=>!retentionColumns[table].includes(k)))fail('Retention may only erase authorized private payload columns');
      this.insert('ops_erasure_permits',{table_name:table,row_id:id,run_id:run});try{this.run(`UPDATE ${table} SET ${Object.keys(values).map(k=>k+'=?').join(',')} WHERE id=?`,...Object.values(values),id);}finally{this.run('DELETE FROM ops_erasure_permits WHERE table_name=? AND row_id=?',table,id);}
    },
    retentionFile(run,file){this.retentionWrite(run,'el_files',file.id,{filename:'deleted-under-retention',content_encrypted:''});},
    eraseRetentionRecord(run,item){
      const {kind,record_id:id}=item,erased={deleted_under_retention:true};
      if(kind==='candidate'){
        for(const job of this.retentionCalendarJobs(id)){for(const j of [job,...this.all('SELECT * FROM ops_provider_jobs WHERE event_key=?','cancel:'+job.event_key)])this.retentionWrite(run,'ops_provider_jobs',j.id,{payload_encrypted:''});}
        const code='DELETED-CANDIDATE-'+id;this.retentionWrite(run,'el_candidates',id,{code,email_hash:hash('deleted-candidate:'+id),user_id:null,payload_encrypted:seal(this.db,{name:'Deleted candidate',email:'',phone:'',notes:'',...erased},`el-candidate:${code}`)});
        for(const a of this.all('SELECT id FROM el_applications WHERE candidate_id=?',id)){
          for(const i of this.all('SELECT * FROM el_interviews WHERE application_id=?',a.id)){
            this.retentionWrite(run,'el_interviews',i.id,{location:'Deleted under retention'});
            for(const s of this.all('SELECT id FROM el_scores WHERE interview_id=?',i.id))this.retentionWrite(run,'el_scores',s.id,{score:0,payload_encrypted:seal(this.db,erased,`el-score:${i.id}`)});
          }
          for(const h of this.all('SELECT id FROM el_hiring_decisions WHERE application_id=?',a.id))this.retentionWrite(run,'el_hiring_decisions',h.id,{payload_encrypted:seal(this.db,erased,`el-hiring:${a.id}`)});
          for(const f of this.all("SELECT * FROM el_files WHERE owner_kind='application' AND owner_id=?",a.id))this.retentionFile(run,f);
          for(const l of this.all('SELECT document_id FROM el_offer_links WHERE application_id=?',a.id)){
            const d=this.elDoc(l.document_id);this.retentionWrite(run,'el_documents',d.id,{payload_encrypted:seal(this.db,{application_id:a.id,staffing_id:d.payload.staffing_id,start_date:d.payload.start_date,...erased},`el-doc:offer:${d.reference}`)});
            for(const e of this.all('SELECT id,kind FROM el_events WHERE document_id=?',d.id))this.retentionWrite(run,'el_events',e.id,{payload_encrypted:seal(this.db,erased,`el-event:${d.id}:${e.kind}`)});
            for(const f of this.all("SELECT * FROM el_files WHERE owner_kind='document' AND owner_id=?",d.id))this.retentionFile(run,f);
          }
        }
      }
      if(kind==='review'){
        this.retentionWrite(run,'el_reviews',id,{goals:'[]'});for(const e of this.all('SELECT * FROM el_review_events WHERE review_id=?',id))this.retentionWrite(run,'el_review_events',e.id,{score:null,payload_encrypted:seal(this.db,erased,`el-review:${id}:${e.kind}`)});
        for(const f of this.all("SELECT * FROM el_files WHERE owner_kind='review' AND owner_id=?",id))this.retentionFile(run,f);
      }
      if(kind==='employee_document')this.retentionWrite(run,'hr_documents',id,{filename:'deleted-under-retention',content_encrypted:''});
      if(kind==='employment'){
        for(const p of this.all('SELECT * FROM hr_profiles WHERE employee_id=?',id))this.retentionWrite(run,'hr_profiles',p.id,{private_encrypted:seal(this.db,{personal:{},contact:{},emergency:{},...erased},`hr-profile:${id}:${p.effective_date}`)});
        for(const s of this.all('SELECT * FROM el_self_requests WHERE employee_id=?',id)){
          this.retentionWrite(run,'el_self_requests',s.id,{payload_encrypted:seal(this.db,erased,`el-self:${id}:${s.kind}:${s.effective_date}`)});for(const f of this.all("SELECT * FROM el_files WHERE owner_kind='self' AND owner_id=?",s.id))this.retentionFile(run,f);
        }
        for(const d of this.all("SELECT id FROM el_documents WHERE employee_id=? AND kind IN('change','rehire')",id)){const doc=this.elDoc(d.id),p=doc.payload;if(p.profile){for(const k of ['personal','contact','emergency'])p.profile[k]={};this.retentionWrite(run,'el_documents',doc.id,{payload_encrypted:seal(this.db,p,`el-doc:${doc.kind}:${doc.reference}`)});}}
      }
      this.insert('ops_erasures',{kind,record_id:id,rule_id:item.rule_id,run_id:run,generation:item.generation||0,summary:'Private payload deleted; stable source IDs, financial journals, payroll, approvals and audit retained'});
    },
    runRetention(actor,d={}){
      this.admin(actor);const automatic=d.automatic===true,items=this.retentionCandidates(actor).filter(x=>x.eligible&&(!automatic||x.automatic));
      if(automatic&&!items.length)return{id:'no-retention-due',deleted:[]};if(d.dry_run!==false)return{id:'preview',dry_run:true,eligible:items};
      if(!this.db.isTransaction)fail('Deletion requires the audited transaction dispatcher');const id=this.insert('ops_retention_runs',{actor_id:actor,date:today(),automatic:automatic?1:0});
      for(const item of items.slice(0,100))this.eraseRetentionRecord(id,item);return{id,deleted:items.slice(0,100).map(({kind,record_id})=>({kind,record_id})),remaining:Math.max(0,items.length-100)};
    },
    lifecycleFile(actor,id){const f=this.get('SELECT * FROM el_files WHERE id=?',id||0);if(f&&!f.content_encrypted){this.elFileOwner(actor,f.owner_kind,f.owner_id,f.visibility);fail('Supporting file deleted under approved retention',410);}return base.lifecycleFile.call(this,actor,id);},
    elFiles(actor,kind,id){return base.elFiles.call(this,actor,kind,id).filter(f=>!!this.get('SELECT content_encrypted FROM el_files WHERE id=?',f.id).content_encrypted);},
    hrDocument(actor,id){if(this.retentionErased('employee_document',id)){const doc=this.get('SELECT * FROM hr_documents WHERE id=?',id),e=this.get('SELECT user_id FROM employees WHERE id=?',doc.employee_id),p=this.hrProfile(doc.employee_id);if(!this.hasHR(actor,'hr_staff')&&!(doc.visibility==='employee'&&e.user_id===actor)&&!(doc.visibility==='supervisor'&&this.hasHR(actor,'supervisor')&&p?.supervisor_id===actor))fail('Confidential document access denied',403);fail('Employee document deleted under approved retention',410);}return base.hrDocument.call(this,actor,id);},
    hrStageOverview(actor){const r=base.hrStageOverview.call(this,actor);r.documents=r.documents.filter(d=>!this.retentionErased('employee_document',d.id));return r;},
    applyCandidate(actor,d){if(this.retentionErased('candidate',d.candidate_id))fail('Candidate data deleted under retention; register a new application identity',410);return base.applyCandidate.call(this,actor,d);},
    submitOffer(actor,d){const a=this.get('SELECT candidate_id FROM el_applications WHERE id=?',d.application_id||0);if(a&&this.retentionErased('candidate',a.candidate_id))fail('Candidate data deleted under retention',410);return base.submitOffer.call(this,actor,d);},
    reviewSelfChange(actor,d){const r=this.get('SELECT * FROM el_self_requests WHERE id=?',d.id||0);if(r&&unseal(this.db,r.payload_encrypted,`el-self:${r.employee_id}:${r.kind}:${r.effective_date}`).deleted_under_retention)fail('Employee request deleted under approved retention',410);return base.reviewSelfChange.call(this,actor,d);},
    recordReviewStep(actor,d){if(this.retentionErased('review',d.id))fail('Review content deleted under retention',410);return base.recordReviewStep.call(this,actor,d);},
    scanNotifications(actor){const r=base.scanNotifications.call(this,actor);this.runRetention(actor,{automatic:true,dry_run:false});return r;},
    lifecycleOverview(actor,filters={}){const r=base.lifecycleOverview.call(this,actor,filters);r.retention_policy='Expired eligible private data can be erased by independently approved rules; legal holds, active employment and financial obligations block erasure. Financial/audit evidence and backup retention are separate.';r.capabilities.privacy=this.opsPrivacy(actor);if(r.capabilities.staff||r.capabilities.admin||r.capabilities.privacy){r.retention_rules=this.all('SELECT r.*,a.actor_id AS approver_id FROM ops_retention_rules r LEFT JOIN ops_retention_approvals a ON a.rule_id=r.id');r.retention_queue=this.retentionCandidates(actor);r.retention_holds=this.all('SELECT * FROM ops_holds');r.retention_runs=this.all('SELECT * FROM ops_retention_runs ORDER BY id DESC LIMIT 30');r.erasures=this.all('SELECT * FROM ops_erasures ORDER BY id DESC LIMIT 100');}return r;}
  };
}
