import {dashboardMethods} from './dashboard.js';
import {workspaceExperienceMethods} from './workspace-experience.js';
import {projectListMethods} from './project-list.js';
import {organizationFinanceMethods} from './organization-finance.js';
import {organizationReportMethods} from './organization-reports.js';
import {releaseSecurityMethods} from './release-security.js';
import {operationsEmploymentMethods} from './operations-employment.js';
import {retentionMethods} from './operations-retention.js';
import {statutoryPolicyMethods} from './operations-policy.js';
import {providerMethods} from './operations-integrations.js';
import {peopleCoreMethods} from './people-core.js';
import {peopleRecruitmentMethods} from './people-recruitment.js';
import {peopleCaseMethods} from './people-cases.js';
import {peopleDevelopmentMethods} from './people-development.js';
import {peopleEmploymentMethods} from './people-employment.js';
import {peoplePayrollMethods} from './people-payroll.js';
import {peopleReportMethods} from './people-reports.js';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { money, decimal, split, LIMIT } from './money.js';
import { lifecycleMethods } from './lifecycle.js';
import { reconciliationMethods } from './reconciliation.js';
import { reportMethods } from './reports.js';
import { completionMethods } from './completion.js';
import { securityMethods } from './security.js';
import { payrollMethods } from './payroll.js';
import { workflowMethods } from './workflow.js';
import { currencyMethods } from './foreign.js';
import { expandedPayrollMethods } from './expanded-payroll.js';
import { inventoryMethods } from './inventory.js';
import { hrCoreMethods } from './hr-core.js';
import { hrLeaveMethods } from './hr-leave.js';
import { hrPayrollMethods } from './hr-payroll.js';
import { accountingCoreMethods } from './accounting-core.js';
import { accountingReportMethods } from './accounting-reports.js';
import { fixedAssetMethods } from './fixed-assets.js';
import { seal, unseal, fingerprint } from './secure.js';

export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status = 400) => { throw new DomainError(message, status); };
const text = (v, label, max = 500) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail(`${label} is required (maximum ${max} characters)`);
  return v.trim();
};
const date = v => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) !== v) fail('Invalid ISO date');
  return v;
};
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:process.env.ERP_TIMEZONE||'Africa/Mogadishu',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const hash = v => createHash('sha256').update(v).digest('hex');
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const parseMoney = (v,options) => { try { return money(v,options); } catch (e) { fail(e.message); } };
const cents = v => parseMoney(v);
const sum = list => { const result = list.reduce((a,b)=>a+b,0); if (!Number.isSafeInteger(result) || Math.abs(result)>LIMIT) fail('Aggregate amount exceeds safe limit'); return result; };

export class ERP {
  constructor(db) { this.db = db;if(db.withSession){let proxy;proxy=new Proxy(this,{get(target,name){const value=Reflect.get(target,name);return typeof value==='function'&&name!=='constructor'?(...args)=>db.withSession(()=>Reflect.apply(value,proxy,args)):value;}});return proxy;} }
  get(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  insert(table, values) {
    if(table==='commitments' && !values.effective_date) values={...values,effective_date:values.journal_id?this.get('SELECT date FROM journals WHERE id=?',values.journal_id).date:values.reason==='Approved spending reservation'?this.get('SELECT r.date FROM requests r JOIN request_lines l ON l.request_id=r.id WHERE l.id=?',values.request_line_id).date:today()};
    const keys = Object.keys(values);
    return Number(this.run(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`, ...Object.values(values)).lastInsertRowid);
  }
  user(id) { const u = this.get('SELECT id,name,email,admin FROM users WHERE id=?', id); if (!u) fail('Authentication required',401); return u; }
  admin(actor) { if (!this.user(actor).admin) fail('Administrator permission required',403); }
  project(actor, id, roles) {
    const p = this.get('SELECT p.*,m.role FROM projects p JOIN memberships m ON m.project_id=p.id WHERE p.id=? AND m.user_id=?', id,actor);
    if (!p || (roles && !roles.includes(p.role))) fail('Project permission denied',403);
    return p;
  }
  active(actor,id,roles) { const p=this.project(actor,id,roles); if(p.status!=='active') fail('Project is closed'); return p; }
  createUser({name,email,password,admin=false}) {
    if(process.env.NODE_ENV==='production'&&(password==='Demo-only-2026!'||String(email).toLowerCase().endsWith('@demo.erp')))fail('Demonstration credentials/accounts are prohibited in production');
    if (typeof password !== 'string' || password.length<12 || password.length>256) fail('Password must be 12–256 characters');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Invalid email');
    const salt=randomBytes(16).toString('hex');
    return this.insert('users',{name:text(name,'Name'),email:email.toLowerCase(),salt,password_hash:scryptSync(password,salt,64).toString('hex'),admin:admin?1:0});
  }
  login(email,password) {
    if (typeof email!=='string' || typeof password!=='string' || password.length>256) fail('Invalid credentials',401);
    const u=this.get('SELECT * FROM users WHERE email=?',email.toLowerCase());
    const actual=scryptSync(password,u?.salt || 'invalid-user-fixed-salt',64);
    if (!u || !timingSafeEqual(actual,Buffer.from(u.password_hash,'hex'))) fail('Invalid credentials',401);
    const token=randomBytes(32).toString('hex');
    this.run('DELETE FROM sessions WHERE expires<?',Date.now());
    this.insert('sessions',{token_hash:hash(token),user_id:u.id,expires:Date.now()+8*60*60*1000});
    return {token,user:this.user(u.id)};
  }
  authenticate(token) { if (!token) fail('Authentication required',401); const s=this.get('SELECT user_id FROM sessions WHERE token_hash=? AND expires>?',hash(token),Date.now()); if(!s) fail('Session expired',401); return s.user_id; }
  logout(token) { this.run('DELETE FROM sessions WHERE token_hash=?',hash(token||'')); }
  execute(actor, action, data, key) {
    this.user(actor);
    if(!data || typeof data!=='object' || Array.isArray(data)) fail('Operation data must be an object');
    if(typeof action!=='string'||action.length>100)fail('Invalid operation');
    this.assertUSD(data);
    if (typeof key!=='string' || key.length<8 || key.length>120) fail('Idempotency-Key is required (8–120 characters)');
    const canonicalPayload=canonical({action,data}),sensitive=/^(org\.|ops\.|el\.|acc\.|hr\.|user\.create|password\.|mfa\.|integration\.configure|payroll\.|employee\.|attendance\.|leave\.)/.test(action);
    const payloadHash=sensitive?fingerprint(this.db,canonicalPayload):hash(canonicalPayload);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.assertAccountEnabled(actor);
      if(this.lifecycleBlockedUser(actor))fail('Application access has ended under an approved departure',403);
      const prior=this.get('SELECT * FROM operations WHERE user_id=? AND key=?',actor,key);
      if(prior) { const expected=sensitive&&!prior.payload_hash.startsWith('hmac:')?hash(canonicalPayload):payloadHash;if(prior.payload_hash!==expected) fail('Idempotency key was used for a different operation',409); const stored=JSON.parse(prior.result),result=stored.encrypted?unseal(this.db,stored.encrypted,`operation:${actor}:${key}`):stored;this.db.exec('COMMIT'); return result; }
      const handlers = {
        'user.access':'setAccountAccess','password.reset.issue':'issuePasswordReset','ops.role':'setOperationsRole','ops.setup':'configureOperations','ops.rehire.submit':'submitRehire','ops.rehire.approve':'approveRehire','ops.retention.submit':'submitRetentionRule','ops.retention.approve':'approveRetentionRule','ops.retention.hold':'setRetentionHold','ops.retention.run':'runRetention','ops.policy.somaliland':'submitSomalilandPolicy','ops.provider.configure':'configureProvider','ops.provider.provision':'queueProvisioning','ops.provider.calendar':'queueCalendar',
        'el.role':'setLifecycleRole','el.policy':'setLifecyclePolicy','el.retention':'setLifecycleRetention','el.staffing.submit':'submitStaffing','el.staffing.review':'reviewStaffingBudget','el.staffing.approve':'approveStaffing','el.vacancy':'publishVacancy','el.candidate':'createCandidate','el.application':'applyCandidate','el.interview':'scheduleInterview','el.interview.cancel':'cancelInterview','el.interview.score':'scoreInterview','el.hiring.decision':'decideHiring','el.offer.submit':'submitOffer','el.offer.approve':'approveOffer','el.offer.response':'respondOffer','el.candidate.convert':'convertCandidate','el.withdraw':'cancelLifecycleDocument','el.template':'createLifecycleTemplate','el.case.start':'startLifecycleCase','el.task':'completeLifecycleTask','el.probation.start':'startProbation','el.probation.review':'recordProbationReview','el.probation.approve':'approveProbationReview','el.equipment':'assignLifecycleEquipment','el.equipment.return':'returnLifecycleEquipment','el.access.request':'requestLifecycleAccess','el.access.approve':'approveLifecycleAccess','el.access.apply':'applyLifecycleAccess','el.review.cycle':'createReviewCycle','el.review.create':'createPerformanceReview','el.review.step':'recordReviewStep','el.training.submit':'submitTraining','el.training.approve':'approveTraining','el.training.purchase':'linkTrainingPurchase','el.training.attendance':'recordTrainingAttendance','el.qualification':'addQualification','el.change.submit':'submitEmploymentChange','el.change.approve':'approveEmploymentChange','el.self.request':'submitSelfChange','el.self.review':'reviewSelfChange','el.departure.submit':'submitDeparture','el.departure.approve':'approveDeparture','el.departure.advance':'linkDepartureAdvance','el.departure.close':'closeDeparture','el.final.policy':'submitFinalPolicy','el.final.policy.approve':'approveFinalPolicy','el.final.payroll':'submitFinalPayroll','el.final.review':'reviewExistingFinalPayroll','el.final.review.approve':'approveExistingFinalPayroll','el.departure.liability':'linkDepartureLiability','el.reminders':'scanLifecycleReminders',
        'project.create':'createProject','membership.set':'setMembership','user.create':'addUser','policy.set':'setPolicy','period.set':'setPeriod',
        'budget.submit':'submitBudget','budget.approve':'approveBudget','source.create':'createSource','funding.promise':'promise','funding.receive':'receive',
        'request.submit':'submitRequest','request.edit':'editRequest','request.approve':'approveRequest','request.cancel':'cancelRequest','po.create':'createPO',
        'bill.post':'postBill','payment.post':'pay','advance.issue':'issueAdvance','advance.settle':'settleAdvance','advance.return':'returnAdvance',
        'exception.authorize':'authorizeException','journal.reverse':'reverse','cash.transfer':'transfer','account.create':'createAccount','reconcile':'reconcile','project.close':'closeProject',
        'budget.amend':'amendBudget','budget.transfer':'transferBudget','document.add':'addDocument',
        'credit.post':'postCredit','supplier.refund':'refundSupplier','funding.return':'returnFunding','promise.cancel':'cancelPromise',
        'correction.authorize':'authorizeCorrection','statement.create':'createStatement','statement.import':'importStatement',
        'statement.match':'matchStatement','statement.unmatch':'unmatchStatement','statement.finalize':'finalizeStatement','statement.reopen':'reopenStatement','reconciliation.offset':'offsetCash',
        'project.complete':'completeProject','project.reopen':'reopenProject','closure.authorize':'authorizeClosure',
        'control.set':'setControl','org.role':'setOrgRole','password.change':'changePassword','sessions.revoke':'revokeSessions','mfa.enroll':'enrollMFA','mfa.confirm':'confirmMFA','mfa.staging.disable':'disableStagingMFA',
        'delegation.create':'delegateApproval','delegation.revoke':'revokeDelegation','comment.add':'addComment','comment.resolve':'resolveComment',
        'expense.post':'postExpense','voucher.submit':'submitVoucher','voucher.approve':'approveVoucher','voucher.post':'postVoucher','voucher.cancel':'cancelVoucher',
        'bill.reissue':'reissueBill','adjustment.submit':'submitJournal','adjustment.approve':'approveJournal','adjustment.post':'postAdjustment','grant.submit':'submitGrant','grant.approve':'approveGrant',
        'employee.create':'createEmployee','employee.state':'employeeState','attendance.record':'recordAttendance','leave.request':'requestLeave','leave.decide':'decideLeave',
        'payroll.rule':'submitPayrollRule','payroll.rule.approve':'approvePayrollRule','payroll.submit':'submitPayroll','payroll.approve':'approvePayroll','payroll.post':'postPayroll',
        'notifications.scan':'scanNotifications','notification.read':'readNotification','integration.configure':'configureIntegration','integration.route':'routeIntegration',
        'supplier.create':'createSupplier','supplier.state':'supplierState','item.create':'createItem','currency.define':'defineCurrency','currency.rate':'recordRate','bill.foreign':'foreignBill',
        'employee.terms.submit':'submitEmployeeTerms','employee.terms.approve':'approveEmployeeTerms',
        'warehouse.create':'createWarehouse','inventory.submit':'submitStock','inventory.approve':'approveStock','inventory.post':'postStock','inventory.cancel':'cancelStock','inventory.reverse':'reverseStock',
        'hr.role':'setHRRole','hr.schedule':'createSchedule','hr.holiday':'addHoliday','hr.profile':'recordHRProfile','hr.payment.submit':'submitPaymentDetails','hr.payment.approve':'approvePaymentDetails','hr.document':'addHRDocument',
        'hr.attendance.correct':'requestAttendanceCorrection','hr.attendance.approve':'approveAttendanceCorrection','hr.attendance.import':'importAttendance','hr.attendance.import.approve':'approveAttendanceImport',
        'hr.timesheet.submit':'submitTimesheet','hr.timesheet.approve':'approveTimesheet','hr.timesheet.cancel':'cancelTimesheet',
        'hr.leave.policy':'submitLeavePolicy','hr.leave.policy.approve':'approveLeavePolicy','hr.leave.enroll':'enrollLeave','hr.leave.cancel':'cancelManagedLeave',
        'hr.period':'createHRPeriod','hr.allocation.submit':'submitAllocationPlan','hr.allocation.approve':'approveAllocationPlan','hr.overtime':'requestOvertime','hr.overtime.approve':'approveOvertime',
        'hr.salary-advance.submit':'submitSalaryAdvance','hr.salary-advance.approve':'approveSalaryAdvance','hr.salary-advance.post':'postSalaryAdvance','hr.salary-advance.return':'returnSalaryAdvance',
        'hr.payroll.submit':'submitManagedPayroll','hr.batch':'createPaymentBatch','hr.batch.post':'postPaymentBatch','hr.reminders':'scanHRReminders',
        'org.unit':'orgUnit','org.fund':'orgFundSubmit','org.fund.approve':'orgFundApprove','org.budget':'orgBudgetSubmit','org.budget.approve':'orgBudgetApprove','org.document':'orgSubmit','org.schedule':'orgSchedule','org.schedule.generate':'orgGenerate','org.asset':'orgAsset','org.asset.approve':'orgAssetApprove','org.asset.cancel':'orgAssetCancel',
        'acc.role':'setAccountingRole','acc.account':'configureAccountingAccount','acc.mapping':'setAccountingMapping','acc.book':'createAccountingBook','acc.year':'createFiscalYear','acc.period':'createFiscalPeriod',
        'acc.fund.policy':'submitFundPolicy','acc.fund.policy.approve':'approveFundPolicy','acc.manual':'submitManualJournal','acc.opening':'submitOpeningBalances','acc.funding.submit':'submitFundingRecognition','acc.transfer':'submitAllocationTransfer',
        'acc.document.approve':'approveAccountingDocument','acc.document.post':'postAccountingDocument','acc.document.cancel':'cancelAccountingDocument','acc.opening.settle':'submitOpeningSettlement',
        'acc.close.authorize':'authorizePeriodClose','acc.period.close':'closeAccountingPeriod','acc.period.reopen':'requestPeriodReopen','acc.period.reopen.approve':'approvePeriodReopen','acc.year.end':'submitYearEnd','acc.year.end.approve':'approveYearEnd',
        'acc.asset.register':'registerFixedAsset','acc.asset.approve':'approveFixedAsset','acc.asset.cancel':'cancelAssetRegister','acc.asset.custody':'recordAssetCustody','acc.asset.policy':'submitAssetPolicy','acc.asset.policy.approve':'approveAssetPolicy','acc.asset.depreciate':'submitDepreciation','acc.asset.dispose':'submitAssetDisposal'
      };
      const method=Object.hasOwn(handlers,action)?handlers[action]:null; if(!method) fail('Unknown operation',404);
      const result=this[method](actor,data);
      const auditData=['acc.role','el.role','ops.role','hr.role'].includes(action)?{user_id:data.user_id,role:data.role,enabled:data.enabled}:/^(org|ops|el|acc|hr|employee|attendance|leave|payroll)\./.test(action)?{id:result.id,restricted:'Accounting/HR/payroll evidence stored in restricted records'}:{...data,...(data.csv?{csv:'[STORED AS STATEMENT ROWS]'}:{}),...(data.documents?{documents:data.documents.map(doc=>({filename:doc.filename,mime:doc.mime,content:'[STORED IN DOCUMENTS]'}))}:{})};
      for(const field of ['password','current_password','new_password','secret','code','terms'])if(field in auditData)auditData[field]='[REDACTED]';
      this.insert('audit',{actor_id:actor,action,entity:String(result.id??data.id??''),details:canonical(auditData)});
      for(const source of this.all('SELECT id FROM funding_sources'))this.checkGrant(source.id);
      this.afterOperation(actor,action,data,result);
      this.insert('operations',{user_id:actor,key,payload_hash:payloadHash,result:JSON.stringify(['mfa.enroll','mfa.confirm','password.reset.issue'].includes(action)?{encrypted:seal(this.db,result,`operation:${actor}:${key}`)}:result)});
      this.db.exec('COMMIT'); return result;
    } catch(e) {
      this.db.exec('ROLLBACK');
      if(e instanceof DomainError) throw e;
      if(/UNIQUE constraint/.test(e.message)) fail('Duplicate reference or document',409);
      if(/CHECK constraint|FOREIGN KEY/.test(e.message)) fail('Invalid record or linked document');
      throw e;
    }
  }
  createProject(actor,d) {
    this.user(d.manager_id||actor);
    const start=date(d.start_date),end=date(d.end_date); if(start>end) fail('Project end date precedes start');
    if(d.activities && !Array.isArray(d.activities))fail('Activities must be an array');
    const activities=(d.activities||['General']).map(a=>text(a,'Activity',80)); if(!activities.length || activities.length>100 || new Set(activities).size!==activities.length) fail('Provide 1–100 unique activities');
    const id=this.insert('projects',{code:text(d.code,'Code',40),name:text(d.name,'Name'),description:text(d.description,'Description',3000),manager_id:d.manager_id||actor,department:text(d.department,'Department'),start_date:start,end_date:end,activities:JSON.stringify(activities),demo:d.demo && this.user(actor).admin?1:0});
    this.insert('memberships',{project_id:id,user_id:actor,role:'manager'});
    if(d.manager_id && d.manager_id!==actor) this.insert('memberships',{project_id:id,user_id:d.manager_id,role:'manager'});
    return {id};
  }
  setMembership(actor,d) {
    this.admin(actor); if(!this.get('SELECT id FROM projects WHERE id=?',d.project_id)) fail('Unknown project'); this.user(d.user_id);
    if(!['viewer','requester','manager','finance'].includes(d.role)) fail('Invalid role');
    this.run('INSERT INTO memberships(project_id,user_id,role) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role',d.project_id,d.user_id,d.role); return {id:d.project_id};
  }
  addUser(actor,d) { this.admin(actor); return {id:this.createUser(d)}; }
  setPolicy(actor,d) {
    this.admin(actor); if(!['budget','spending'].includes(d.kind) || !Array.isArray(d.rules) || !d.rules.length) fail('Invalid approval policy');
    const rules=d.rules.map(r=>({min:parseMoney(r.min,{zero:true}),max:r.max===null?null:cents(r.max),levels:r.levels})).sort((a,b)=>a.min-b.min);
    let expected=0;
    for(const r of rules) {
      if(r.min!==expected || (r.max!==null && r.max<r.min) || !Array.isArray(r.levels) || !r.levels.length || r.levels.length>10) fail('Thresholds must cover all amounts without gaps or overlaps');
      for(const level of r.levels) if(!Array.isArray(level) || !level.length || level.some(role=>!['manager','finance'].includes(role))) fail('Approvers must be manager or finance');
      expected=r.max===null?null:r.max+1;
    }
    if(expected!==null) fail('Last threshold must have no maximum');
    this.run('INSERT INTO approval_rules(kind,rules) VALUES(?,?) ON CONFLICT(kind) DO UPDATE SET rules=excluded.rules',d.kind,JSON.stringify(rules)); return {id:d.kind};
  }
  policy(kind,amount) {
    const stored=this.get('SELECT rules FROM approval_rules WHERE kind=?',kind); if(!stored) fail('Administrator must configure an approval policy first');
    const rule=JSON.parse(stored.rules).find(r=>amount>=r.min && (r.max===null || amount<=r.max)); if(!rule) fail('No approval policy covers this amount');
    return JSON.stringify(rule.levels);
  }
  setPeriod(actor,d) {
    this.admin(actor); const start=date(d.start_date),end=date(d.end_date); if(start>end || !['open','closed'].includes(d.state)) fail('Invalid accounting period');
    if(d.id) { const old=this.get('SELECT * FROM periods WHERE id=?',d.id); if(!old || old.start_date!==start || old.end_date!==end) fail('Only period state may be changed'); this.run('UPDATE periods SET state=? WHERE id=?',d.state,d.id); return {id:d.id}; }
    if(this.get('SELECT id FROM periods WHERE start_date<=? AND end_date>=?',end,start)) fail('Accounting periods cannot overlap');
    return {id:this.insert('periods',{start_date:start,end_date:end,state:d.state})};
  }
  postingDate(v) { const dt=date(v); if(!this.get("SELECT id FROM periods WHERE state='open' AND start_date<=? AND end_date>=?",dt,dt)) fail('No open accounting period covers this date'); return dt; }
  currentBudget(project) { return this.get("SELECT * FROM budget_versions WHERE project_id=? AND state='approved' ORDER BY version DESC LIMIT 1",project); }
  submitBudget(actor,d) {
    const p=this.active(actor,d.project_id,['manager','finance']); const lines=d.lines;
    if(!Array.isArray(lines) || !lines.length || lines.length>200) fail('Provide 1–200 budget lines');
    const normalized=lines.map(l=>({category:text(l.category,'Category',80),activity:text(l.activity,'Activity',80),start_date:date(l.start_date),end_date:date(l.end_date),amount:cents(l.amount)}));
    for(const l of normalized) {
      if(!JSON.parse(p.activities).includes(l.activity) || l.start_date<p.start_date || l.end_date>p.end_date || l.start_date>l.end_date) fail('Budget activity/period must fit the project');
      if(normalized.some(other=>other!==l && other.category===l.category && other.activity===l.activity && other.start_date<=l.end_date && other.end_date>=l.start_date)) fail('Budget periods overlap within category/activity');
    }
    const prior=this.currentBudget(p.id); const version=(this.get('SELECT MAX(version) AS v FROM budget_versions WHERE project_id=?',p.id)?.v||0)+1;
    const id=this.insert('budget_versions',{project_id:p.id,version,previous_id:prior?.id||null,reason:text(d.reason,'Budget rationale',2000),creator_id:actor,approval_policy:this.policy('budget',sum(normalized.map(l=>l.amount)))});
    for(const l of normalized) this.insert('budget_lines',{budget_id:id,...l}); return {id,version};
  }
  approve(actor,kind,doc,projects,revision=1) {
    if(doc.creator_id===actor) fail('You cannot approve your own document',403);
    const prior=this.all('SELECT * FROM approvals WHERE kind=? AND document_id=? AND revision=? ORDER BY level',kind,doc.id,revision);
    if(prior.some(a=>a.user_id===actor)) fail('Each approval level requires a distinct approver',403);
    const levels=JSON.parse(doc.approval_policy),level=prior.length; if(level>=levels.length) fail('Already approved');
    for(const p of projects) this.active(actor,p,levels[level]);
    this.insert('approvals',{kind,document_id:doc.id,revision,level,user_id:actor}); return level+1===levels.length;
  }
  exceptionAmount(project) { return this.get('SELECT COALESCE(MAX(amount),0) AS amount FROM exceptions WHERE project_id=? AND expiry>=?',project,today()).amount; }
  checkBudget(project,budget=null) {
    budget=budget||this.currentBudget(project); if(!budget) fail('Project has no approved budget');
    const lines=this.all('SELECT * FROM budget_lines WHERE budget_id=?',budget.id);
    const charges=this.all('SELECT l.category,l.activity,c.date,SUM(c.amount) AS amount FROM budget_charges c JOIN request_lines l ON l.id=c.request_line_id WHERE l.project_id=? GROUP BY l.category,l.activity,c.date',project);
    const reserved=this.all('SELECT l.category,l.activity,r.date,SUM(c.amount) AS amount FROM commitments c JOIN request_lines l ON l.id=c.request_line_id JOIN requests r ON r.id=l.request_id WHERE l.project_id=? GROUP BY l.category,l.activity,r.date',project);
    let deficit=0; const consumption=new Map(lines.map(l=>[l.id,0]));
    for(const item of [...charges,...reserved]) {
      if(!item.amount) continue;
      const line=lines.find(l=>l.category===item.category && l.activity===item.activity && l.start_date<=item.date && l.end_date>=item.date);
      if(!line) fail('Budget amendment leaves charges or commitments outside its categories/periods');
      consumption.set(line.id,consumption.get(line.id)+item.amount);
    }
    for(const l of lines) deficit+=Math.max(0,consumption.get(l.id)-l.amount);
    if(deficit>this.exceptionAmount(project)) fail('Insufficient remaining budget; an authorized exception is required',409);
  }
  approveBudget(actor,d) {
    const doc=this.get('SELECT * FROM budget_versions WHERE id=?',d.id); if(!doc) fail('Unknown budget',404);
    this.active(actor,doc.project_id,['manager','finance']); if(doc.state!=='submitted') fail('Budget is already approved',409);
    const latest=this.currentBudget(doc.project_id); if((latest?.id||null)!==doc.previous_id) fail('Budget proposal is stale; submit against current approved version',409);
    if(this.approve(actor,'budget',doc,[doc.project_id])) { this.checkBudget(doc.project_id,doc); this.run("UPDATE budget_versions SET state='approved' WHERE id=?",doc.id); }
    return {id:doc.id,state:this.get('SELECT state FROM budget_versions WHERE id=?',doc.id).state};
  }
  createSource(actor,d) {
    const p=this.active(actor,d.project_id,['manager','finance']); const start=date(d.start_date),end=date(d.end_date);
    if(start<p.start_date || end>p.end_date || start>end) fail('Funding eligibility dates must fit the project');
    if(!['donor','organization'].includes(d.type) || !Array.isArray(d.categories)) fail('Specify source type and category whitelist');
    return {id:this.insert('funding_sources',{project_id:p.id,name:text(d.name,'Source name'),type:d.type,categories:JSON.stringify(d.categories.map(c=>text(c,'Category',80))),start_date:start,end_date:end})};
  }
  source(actor,id,dt,category=null,roles=null) {
    const s=this.get('SELECT * FROM funding_sources WHERE id=?',id); if(!s) fail('Unknown funding source');
    this.active(actor,s.project_id,roles);
    if(dt<s.start_date || dt>s.end_date) fail('Date is outside funding source eligibility');
    const cats=JSON.parse(s.categories); if(category && cats.length && !cats.includes(category)) fail('Category is not eligible for this funding source'); return s;
  }
  promise(actor,d) { const dt=date(d.date),s=this.source(actor,d.source_id,dt,null,['finance']); return {id:this.insert('promises',{source_id:s.id,amount:cents(d.amount),reference:text(d.reference,'Promise reference'),date:dt})}; }
  gl(type) { const a=this.get('SELECT id FROM accounts WHERE type=? ORDER BY id LIMIT 1',type); if(!a) fail(`Missing ${type} account`); return a.id; }
  cashAccount(id) { const a=this.get("SELECT * FROM accounts WHERE id=? AND type IN('bank','cash','mobile')",id); if(!a) fail('Choose a bank, cash or mobile-money account'); return a; }
  journal(actor,{kind,reference,date:dt,description,lines,reversal_of=null}) {
    this.postingDate(dt); if(sum(lines.map(l=>l.amount))!==0 || lines.length<2) fail('Journal must balance');
    for(const l of lines) {
      if(l.project_id===null){this.validateOrgLedger(actor,l,dt,reversal_of);continue;}
      const s=this.get('SELECT project_id FROM funding_sources WHERE id=?',l.source_id); if(!s || s.project_id!==l.project_id) fail('Journal funding source/project mismatch');
      this.active(actor,l.project_id,['finance']);
    }
    const id=this.insert('journals',{kind,reference:text(reference,'Reference'),date:dt,description:text(description,'Description',2000),actor_id:actor,reversal_of});
    for(const l of lines) if(l.amount) this.insert('journal_lines',{journal_id:id,...l});
    this.run("UPDATE journals SET state='posted' WHERE id=?",id); return id;
  }
  pair(project,source,debit,credit,amount) { return [{project_id:project,source_id:source,account_id:debit,amount},{project_id:project,source_id:source,account_id:credit,amount:-amount}]; }
  receive(actor,d) {
    const dt=this.postingDate(d.date),s=this.source(actor,d.source_id,dt,null,['finance']); this.cashAccount(d.account_id);
    return {id:this.journal(actor,{kind:'receipt',reference:d.reference,date:dt,description:`Funding received: ${s.name}`,lines:this.pair(s.project_id,s.id,d.account_id,this.gl('funding'),cents(d.amount))})};
  }
  normalizeAllocations(actor,lines,dt) {
    if(!Array.isArray(lines) || !lines.length || lines.length>100) fail('Provide 1–100 spending allocations');
    return lines.map(l=>{
      const p=this.spendable(actor,l.project_id,['requester','manager','finance']);
      const category=text(l.category,'Category',80),activity=text(l.activity,'Activity',80); const s=this.source(actor,l.source_id,dt,category);
      if(s.project_id!==p.id) fail('Funding source belongs to another project');
      const budget=this.currentBudget(p.id); if(!budget || !this.get('SELECT id FROM budget_lines WHERE budget_id=? AND category=? AND activity=? AND start_date<=? AND end_date>=?',budget.id,category,activity,dt,dt)) fail('Allocation must identify an approved budget category/activity/period');
      return {project_id:p.id,source_id:s.id,category,activity,amount:cents(l.amount)};
    });
  }
  submitRequest(actor,d) {
    const dt=date(d.date),lines=this.normalizeAllocations(actor,d.lines,dt);
    const id=this.insert('requests',{title:text(d.title,'Request title',1000),creator_id:actor,date:dt,kind:d.kind||'purchase',approval_policy:this.policy('spending',sum(lines.map(l=>l.amount)))});
    for(const l of lines) this.insert('request_lines',{request_id:id,...l}); return {id};
  }
  request(actor,id,roles) {
    const r=this.get('SELECT * FROM requests WHERE id=?',id); if(!r) fail('Unknown spending request',404);
    r.lines=this.all('SELECT * FROM request_lines WHERE request_id=? ORDER BY id',id);
    for(const l of r.lines) this.active(actor,l.project_id,roles); return r;
  }
  balance(line) { return this.get('SELECT COALESCE(SUM(amount),0) AS n FROM commitments WHERE request_line_id=?',line).n; }
  editRequest(actor,d) {
    const old=this.request(actor,d.id,['requester','manager','finance']); if(old.creator_id!==actor) fail('Only the requester may replace this request',403);
    if(old.state==='cancelled' || this.get('SELECT id FROM purchase_orders WHERE request_id=?',old.id) || this.get('SELECT id FROM advances WHERE request_id=?',old.id)) fail('Request already executed; cancel remaining commitment and submit a new request');
    for(const l of old.lines) { const remaining=this.balance(l.id); if(remaining) this.insert('commitments',{request_line_id:l.id,amount:-remaining,reason:'Request replaced; reapproval required'}); }
    this.run("UPDATE requests SET state='cancelled' WHERE id=?",old.id);
    const result=this.submitRequest(actor,d); this.run('UPDATE requests SET supersedes_id=?,revision=? WHERE id=?',old.id,old.revision+1,result.id); return {...result,reapproval_required:true};
  }
  approveRequest(actor,d) {
    const r=this.request(actor,d.id,['manager','finance']); if(r.state!=='submitted') fail('Request is not awaiting approval',409);
    for(const l of r.lines) this.source(actor,l.source_id,r.date,l.category);
    const projects=[...new Set(r.lines.map(l=>l.project_id))];
    if(this.approve(actor,'spending',r,projects,r.revision)) {
      for(const l of r.lines) this.insert('commitments',{request_line_id:l.id,amount:l.amount,reason:'Approved spending reservation'});
      for(const p of projects) this.checkBudget(p);
      this.run("UPDATE requests SET state='approved' WHERE id=?",r.id);
    }
    return {id:r.id,state:this.get('SELECT state FROM requests WHERE id=?',r.id).state};
  }
  cancelRequest(actor,d) {
    const r=this.request(actor,d.id,['manager','finance']); if(r.state==='cancelled') fail('Request already cancelled',409);
    if(this.get('SELECT id FROM advances WHERE request_id=?',r.id) && this.advanceOutstanding(r.id)>0) fail('Settle or return the advance before cancellation');
    for(const l of r.lines) { const n=this.balance(l.id); if(n) this.insert('commitments',{request_line_id:l.id,amount:-n,reason:text(d.reason,'Cancellation reason',2000)}); }
    this.run("UPDATE requests SET state='cancelled' WHERE id=?",r.id); return {id:r.id};
  }
  createPO(actor,d) {
    const r=this.request(actor,d.request_id,['manager','finance']); if(r.state!=='approved' || this.get('SELECT id FROM advances WHERE request_id=?',r.id)) fail('PO requires an approved request without an advance');
    const dt=date(d.date); if(dt<r.date) fail('PO date precedes request'); for(const l of r.lines) this.source(actor,l.source_id,dt,l.category);
    return {id:this.insert('purchase_orders',{request_id:r.id,supplier:text(d.supplier,'Supplier'),reference:text(d.reference,'PO reference'),date:dt,created_by:actor})};
  }
  remainingCharge(actor,line,amount,dt) {
    const s=this.source(actor,line.source_id,dt,line.category,['finance']); if(s.project_id!==line.project_id) fail('Source mismatch');
    if(amount>this.balance(line.id)) fail('Charge exceeds outstanding commitment',409);
    const budget=this.currentBudget(line.project_id); const period=this.get('SELECT * FROM budget_lines WHERE budget_id=? AND category=? AND activity=? AND start_date<=? AND end_date>=?',budget.id,line.category,line.activity,dt,dt);
    const req=this.get('SELECT date FROM requests WHERE id=?',line.request_id);
    if(!period || req.date<period.start_date || req.date>period.end_date) fail('Actual charge must be in the reserved budget period');
  }
  postBill(actor,d) {
    const po=this.get('SELECT * FROM purchase_orders WHERE id=?',d.po_id); if(!po) fail('Unknown purchase order');
    const r=this.request(actor,po.request_id,['finance']); if(r.state!=='approved') fail('PO is cancelled or unapproved');
    const dt=this.postingDate(d.date); if(dt<po.date) fail('Bill date precedes PO');
    if(!Array.isArray(d.lines) || !d.lines.length || new Set(d.lines.map(l=>l.request_line_id)).size!==d.lines.length) fail('Provide unique billed allocation lines');
    const lines=d.lines.map(item=>{const l=r.lines.find(l=>l.id===item.request_line_id); if(!l) fail('Bill allocation is not on this PO'); const amount=cents(item.amount); this.remainingCharge(actor,l,amount,dt); return {...l,billed:amount};});
    const account=d.cost_type==='asset'?this.gl('asset'):this.gl('expense'); if(d.cost_type && !['asset','expense'].includes(d.cost_type)) fail('Invalid cost classification');
    const id=this.journal(actor,{kind:'bill',reference:`bill:${po.supplier}:${text(d.invoice,'Invoice')}`,date:dt,description:`Supplier bill ${d.invoice}`,lines:lines.flatMap(l=>this.pair(l.project_id,l.source_id,account,this.gl('payable'),l.billed))});
    const bill=this.insert('bills',{po_id:po.id,supplier:po.supplier,invoice:d.invoice,journal_id:id,date:dt,due_date:d.due_date||dt});
    for(const l of lines) {
      this.insert('bill_lines',{bill_id:bill,request_line_id:l.id,amount:l.billed});
      this.insert('budget_charges',{request_line_id:l.id,amount:l.billed,journal_id:id,date:dt});
      this.insert('commitments',{request_line_id:l.id,amount:-l.billed,journal_id:id,reason:'Partial supplier billing'});
    }
    return {id:bill,journal_id:id};
  }
  reversed(journal) { return Boolean(this.get('SELECT id FROM journals WHERE reversal_of=?',journal)); }
  cash(project,source,account=null) {
    return this.get(`SELECT COALESCE(SUM(l.amount),0) AS amount FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE l.project_id=? AND l.source_id=? AND a.type IN('bank','cash','mobile')${account===null?'':' AND a.id=?'}`,project,source,...(account===null?[]:[account])).amount;
  }
  sufficientCash(lines,account) {
    this.cashAccount(account); const grouped=new Map();
    for(const l of lines) { const key=`${l.project_id}:${l.source_id}`; const prev=grouped.get(key)||{...l,amount:0}; prev.amount+=l.amount; grouped.set(key,prev); }
    for(const l of grouped.values()) if(l.amount>this.cash(l.project_id,l.source_id,account)) fail('Insufficient project/source cash in this account',409);
  }
  unpaid(bill) {
    const total=this.get('SELECT COALESCE(SUM(amount),0) AS n FROM bill_lines WHERE bill_id=?',bill.id).n;
    if(this.reversed(bill.journal_id)) return 0;
    const paid=this.get('SELECT COALESCE(SUM(p.amount),0) AS n FROM payments p WHERE p.bill_id=? AND NOT EXISTS(SELECT 1 FROM journals r WHERE r.reversal_of=p.journal_id)',bill.id).n;
    return total-paid;
  }
  projectUnpaid(bill,project) {
    if(this.reversed(bill.journal_id))return 0;
    const total=this.get('SELECT COALESCE(SUM(bl.amount),0) AS n FROM bill_lines bl JOIN request_lines l ON l.id=bl.request_line_id WHERE bl.bill_id=? AND l.project_id=?',bill.id,project).n;
    const paid=this.get('SELECT COALESCE(SUM(pa.amount),0) AS n FROM payment_allocations pa JOIN payments p ON p.id=pa.payment_id JOIN bill_lines bl ON bl.id=pa.bill_line_id JOIN request_lines l ON l.id=bl.request_line_id WHERE bl.bill_id=? AND l.project_id=? AND NOT EXISTS(SELECT 1 FROM journals j WHERE j.reversal_of=p.journal_id)',bill.id,project).n;
    return total-paid;
  }
  canPayBill(actor,bill) {
    const projects=this.all('SELECT DISTINCT l.project_id FROM bill_lines bl JOIN request_lines l ON l.id=bl.request_line_id WHERE bl.bill_id=?',bill.id);
    return projects.every(p=>this.get("SELECT 1 FROM memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.project_id=? AND m.role='finance' AND p.status='active'",actor,p.project_id));
  }
  pay(actor,d) {
    const bill=this.get('SELECT * FROM bills WHERE id=?',d.bill_id); if(!bill) fail('Unknown bill');
    const po=this.get('SELECT * FROM purchase_orders WHERE id=?',bill.po_id); this.request(actor,po.request_id,['finance']);
    const dt=this.postingDate(d.date); if(dt<bill.date) fail('Payment date precedes bill'); const amount=cents(d.amount); if(amount>this.unpaid(bill)) fail('Payment exceeds unpaid bill',409);
    const lines=this.billAllocations(bill.id).map(l=>({...l,weight:Math.max(0,l.unpaid)})).filter(l=>l.weight>0);
    const weights=split(amount,lines.map(l=>l.weight)); const allocations=lines.map((l,i)=>({...l,amount:weights[i]})).filter(l=>l.amount);
    this.sufficientCash(allocations,d.account_id);
    const journal=this.journal(actor,{kind:'payment',reference:`payment:${d.account_id}:${text(d.reference,'Payment reference')}`,date:dt,description:`Payment of ${bill.invoice}`,lines:allocations.flatMap(l=>this.pair(l.project_id,l.source_id,this.gl('payable'),d.account_id,l.amount))});
    const id=this.insert('payments',{bill_id:bill.id,journal_id:journal,account_id:d.account_id,reference:d.reference,amount});
    for(const l of allocations) this.insert('payment_allocations',{payment_id:id,bill_line_id:l.bill_line_id,amount:l.amount});
    return {id,journal_id:journal};
  }
  advanceOutstanding(request) {
    const a=this.get('SELECT id FROM advances WHERE request_id=?',request); if(!a) return 0;
    return this.get('SELECT COALESCE(SUM(amount),0) AS n FROM advance_lines WHERE advance_id=?',a.id).n-this.get('SELECT COALESCE(SUM(amount),0) AS n FROM settlements WHERE advance_id=?',a.id).n;
  }
  issueAdvance(actor,d) {
    const r=this.request(actor,d.request_id,['finance']); if(r.state!=='approved' || this.get('SELECT id FROM purchase_orders WHERE request_id=?',r.id)) fail('Advance requires an approved request without a PO');
    const dt=this.postingDate(d.date); if(dt<r.date) fail('Advance date precedes request');
    for(const l of r.lines) this.source(actor,l.source_id,dt,l.category); this.sufficientCash(r.lines,d.account_id);
    const journal=this.journal(actor,{kind:'advance',reference:d.reference,date:dt,description:`Advance: ${text(d.beneficiary,'Beneficiary')}`,lines:r.lines.flatMap(l=>this.pair(l.project_id,l.source_id,this.gl('advance'),d.account_id,l.amount))});
    const id=this.insert('advances',{request_id:r.id,beneficiary:d.beneficiary,journal_id:journal});
    for(const l of r.lines) this.insert('advance_lines',{advance_id:id,request_line_id:l.id,amount:l.amount}); return {id,journal_id:journal};
  }
  advanceMovement(actor,d,kind) {
    const a=this.get('SELECT * FROM advances WHERE id=?',d.advance_id); if(!a) fail('Unknown advance');
    const r=this.request(actor,a.request_id,['finance']); const l=r.lines.find(l=>l.id===d.request_line_id); if(!l) fail('Unknown advance allocation');
    const dt=this.postingDate(d.date); const issued=this.get('SELECT date FROM journals WHERE id=?',a.journal_id); if(dt<issued.date) fail('Settlement date precedes advance');
    const amount=cents(d.amount); const outstanding=this.get('SELECT amount FROM advance_lines WHERE advance_id=? AND request_line_id=?',a.id,l.id).amount-this.get('SELECT COALESCE(SUM(s.amount),0) AS n FROM settlements s WHERE s.advance_id=? AND s.request_line_id=? AND NOT EXISTS(SELECT 1 FROM journals j WHERE j.reversal_of=s.journal_id)',a.id,l.id).n;
    if(amount>outstanding) fail('Movement exceeds outstanding advance');
    if(kind==='settlement') this.remainingCharge(actor,l,amount,dt); else this.cashAccount(d.account_id);
    const debit=kind==='settlement'?this.gl(d.cost_type==='asset'?'asset':'expense'):d.account_id;
    const journal=this.journal(actor,{kind,reference:d.reference,date:dt,description:text(d.evidence,'Accepted expenditure evidence / return reason',2000),lines:this.pair(l.project_id,l.source_id,debit,this.gl('advance'),amount)});
    const id=this.insert('settlements',{advance_id:a.id,request_line_id:l.id,amount,kind,journal_id:journal,evidence:d.evidence});
    if(kind==='settlement') { this.insert('budget_charges',{request_line_id:l.id,amount,journal_id:journal,date:dt}); this.insert('commitments',{request_line_id:l.id,amount:-amount,journal_id:journal,reason:'Accepted advance expenditure'}); }
    return {id,journal_id:journal};
  }
  settleAdvance(actor,d) { return this.advanceMovement(actor,d,'settlement'); }
  returnAdvance(actor,d) { return this.advanceMovement(actor,d,'return'); }
  authorizeException(actor,d) {
    this.active(actor,d.project_id,['finance']); const expiry=date(d.expiry); if(expiry<today()) fail('Exception expiry is in the past');
    return {id:this.insert('exceptions',{project_id:d.project_id,amount:cents(d.amount),expiry,reason:text(d.reason,'Authorized exception justification',2000),actor_id:actor})};
  }
  reverse(actor,d) {
    const original=this.get("SELECT * FROM journals WHERE id=? AND state='posted'",d.id); if(!original) fail('Unknown posted journal');
    if(original.reversal_of || this.reversed(original.id)) fail('Journal already reversed or is itself a reversal',409);
    if(['advance','settlement','return'].includes(original.kind)) fail('Advance corrections require a reviewed adjustment workflow (future milestone)');
    const originalLines=this.all('SELECT * FROM journal_lines WHERE journal_id=?',original.id);
    for(const l of originalLines) this.active(actor,l.project_id,['finance']);
    if(original.kind==='bill') {
      const bill=this.get('SELECT * FROM bills WHERE journal_id=?',original.id);
      if(this.get('SELECT id FROM payments p WHERE bill_id=? AND NOT EXISTS(SELECT 1 FROM journals j WHERE j.reversal_of=p.journal_id)',bill.id)) fail('Reverse linked payments before reversing the bill');
    }
    const dt=this.postingDate(d.date); if(dt<original.date) fail('Reversal date precedes original');
    const cashCredits=originalLines.filter(l=>l.amount>0 && ['bank','cash','mobile'].includes(this.get('SELECT type FROM accounts WHERE id=?',l.account_id).type));
    for(const account of new Set(cashCredits.map(l=>l.account_id))) this.sufficientCash(cashCredits.filter(l=>l.account_id===account),account);
    const id=this.journal(actor,{kind:'reversal',reference:d.reference,date:dt,description:text(d.reason,'Reversal justification',2000),reversal_of:original.id,lines:originalLines.map(l=>({account_id:l.account_id,project_id:l.project_id,source_id:l.source_id,amount:-l.amount}))});
    for(const c of this.all('SELECT * FROM budget_charges WHERE journal_id=?',original.id)) this.insert('budget_charges',{request_line_id:c.request_line_id,amount:-c.amount,journal_id:id,date:c.date});
    for(const c of this.all('SELECT c.*,r.state AS request_state FROM commitments c JOIN request_lines l ON l.id=c.request_line_id JOIN requests r ON r.id=l.request_id WHERE c.journal_id=?',original.id)) if(c.request_state!=='cancelled')this.insert('commitments',{request_line_id:c.request_line_id,amount:-c.amount,journal_id:id,reason:'Linked reversal'});
    if(original.kind==='bill')for(const p of new Set(originalLines.map(l=>l.project_id))) this.checkBudget(p);
    return {id};
  }
  transfer(actor,d) {
    const dt=this.postingDate(d.date),s=this.source(actor,d.source_id,dt,null,['finance']),amount=cents(d.amount);
    if(d.from_account_id===d.to_account_id) fail('Choose different transfer accounts'); this.cashAccount(d.to_account_id);
    this.sufficientCash([{project_id:s.project_id,source_id:s.id,amount}],d.from_account_id);
    return {id:this.journal(actor,{kind:'transfer',reference:d.reference,date:dt,description:'Internal cash transfer',lines:this.pair(s.project_id,s.id,d.to_account_id,d.from_account_id,amount)})};
  }
  createAccount(actor,d) { this.admin(actor); if(!['bank','cash','mobile'].includes(d.type)) fail('Only cash accounts may be added'); return {id:this.insert('accounts',{code:text(d.code,'Account code'),name:text(d.name,'Account name'),type:d.type})}; }
  reconcile(actor,d) {
    this.admin(actor); this.cashAccount(d.account_id); const dt=date(d.date); const statement=parseMoney(d.statement_balance,{zero:true,signed:true});
    const lines=this.all('SELECT l.id,l.amount FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE l.account_id=? AND j.date<=?',d.account_id,dt);
    const outstanding=d.outstanding_line_ids||[]; if(!Array.isArray(outstanding) || new Set(outstanding).size!==outstanding.length || outstanding.some(id=>!lines.some(l=>l.id===id))) fail('Invalid outstanding cash lines');
    const pending=sum(lines.filter(l=>outstanding.includes(l.id)).map(l=>l.amount));
    const difference=sum(lines.map(l=>l.amount))-statement-pending;
    if(difference!==0) fail(`Reconciliation difference is ${decimal(difference)}; investigate before accepting`,409);
    const watermark=this.get('SELECT COALESCE(MAX(id),0) AS id FROM journal_lines WHERE account_id=?',d.account_id).id;
    return {id:this.insert('reconciliations',{account_id:d.account_id,date:dt,statement_balance:statement,outstanding:JSON.stringify(outstanding),difference,actor_id:actor,line_watermark:watermark}),difference:decimal(difference)};
  }
  closeProject(actor,d) {
    this.active(actor,d.id,['manager']); const m=this.metrics(d.id);
    if(m.commitment || m.liability || m.advances || m.cash) fail('Close requires zero commitments, liabilities, advances and residual cash');
    const lines=this.all("SELECT l.*,j.date FROM journal_lines l JOIN journals j ON j.id=l.journal_id JOIN accounts a ON a.id=l.account_id WHERE l.project_id=? AND a.type IN('bank','cash','mobile')",d.id);
    for(const l of lines) { const rec=this.get('SELECT * FROM reconciliations WHERE account_id=? AND date>=? ORDER BY id DESC LIMIT 1',l.account_id,l.date); if(!rec || JSON.parse(rec.outstanding).includes(l.id) || rec.line_watermark<l.id || this.get('SELECT jl.id FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id WHERE jl.account_id=? AND jl.id>? AND j.date<=? LIMIT 1',l.account_id,rec.line_watermark,rec.date)) fail('Cash records require current reconciliation'); }
    this.run("UPDATE projects SET status='closed' WHERE id=?",d.id); return {id:d.id};
  }
  metrics(project) {
    const budget=this.currentBudget(project); const approved=budget?this.get('SELECT COALESCE(SUM(amount),0) AS n FROM budget_lines WHERE budget_id=?',budget.id).n:0;
    const actual=this.get('SELECT COALESCE(SUM(c.amount),0) AS n FROM budget_charges c JOIN request_lines l ON l.id=c.request_line_id WHERE l.project_id=?',project).n;
    const commitment=this.get('SELECT COALESCE(SUM(c.amount),0) AS n FROM commitments c JOIN request_lines l ON l.id=c.request_line_id WHERE l.project_id=?',project).n;
    const balances=this.all('SELECT a.type,COALESCE(SUM(l.amount),0) AS n FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE l.project_id=? GROUP BY a.type',project);
    const value=type=>balances.find(b=>b.type===type)?.n||0;
    const promised=this.get('SELECT COALESCE(SUM(p.amount),0) AS n FROM promises p JOIN funding_sources s ON s.id=p.source_id WHERE s.project_id=?',project).n;
    const received=this.get("SELECT COALESCE(-SUM(l.amount),0) AS n FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE l.project_id=? AND a.type='funding'",project).n;
    const payments=this.get("SELECT COALESCE(SUM(l.amount),0) AS n FROM journal_lines l JOIN journals j ON j.id=l.journal_id JOIN accounts a ON a.id=l.account_id WHERE l.project_id=? AND a.type='payable' AND (j.kind='payment' OR j.reversal_of IN(SELECT id FROM journals WHERE kind='payment'))",project).n;
    return {approved,promised,received,commitment,actual,liability:0-value('payable'),payments,advances:value('advance'),remaining:approved-actual-commitment,cash:value('bank')+value('cash')+value('mobile')};
  }
  listProjects(actor) { return this.all('SELECT p.*,m.role FROM projects p JOIN memberships m ON m.project_id=p.id WHERE m.user_id=? ORDER BY p.id',actor).map(p=>({...p,activities:JSON.parse(p.activities),metrics:Object.fromEntries(Object.entries(this.metrics(p.id)).map(([k,v])=>[k,decimal(v)]))})); }
  dashboard(actor,id) {
    this.db.exec('BEGIN');
    try {
      const p=this.project(actor,id); const metrics=Object.fromEntries(Object.entries(this.metrics(id)).map(([k,v])=>[k,decimal(v)]));
      const budgets=this.all('SELECT * FROM budget_versions WHERE project_id=? ORDER BY version DESC',id).map(b=>({...b,lines:this.all('SELECT * FROM budget_lines WHERE budget_id=?',b.id).map(l=>({...l,amount:decimal(l.amount)})),approvals:this.all("SELECT a.*,u.name FROM approvals a JOIN users u ON u.id=a.user_id WHERE kind='budget' AND document_id=?",b.id)}));
      const sources=this.all('SELECT * FROM funding_sources WHERE project_id=?',id).map(s=>({...s,categories:JSON.parse(s.categories),cash:decimal(this.cash(id,s.id))}));
      const requests=this.all('SELECT DISTINCT r.* FROM requests r JOIN request_lines l ON l.request_id=r.id WHERE l.project_id=? ORDER BY r.id DESC',id).map(r=>({...r,lines:this.all('SELECT * FROM request_lines WHERE request_id=? AND project_id=?',r.id,id).map(l=>({...l,amount:decimal(l.amount),remaining:decimal(this.balance(l.id))})),approvals:this.all("SELECT a.*,u.name FROM approvals a JOIN users u ON u.id=a.user_id WHERE kind='spending' AND document_id=?",r.id),po:this.get('SELECT * FROM purchase_orders WHERE request_id=?',r.id),advance:this.get('SELECT * FROM advances WHERE request_id=?',r.id)}));
      const bills=this.all('SELECT DISTINCT b.* FROM bills b JOIN bill_lines bl ON bl.bill_id=b.id JOIN request_lines l ON l.id=bl.request_line_id WHERE l.project_id=? ORDER BY b.id DESC',id).map(b=>({...b,unpaid:decimal(this.projectUnpaid(b,id)),can_pay:this.canPayBill(actor,b),total_unpaid:this.canPayBill(actor,b)?decimal(this.unpaid(b)):undefined,reversed:this.reversed(b.journal_id),lines:this.all('SELECT bl.* FROM bill_lines bl JOIN request_lines l ON l.id=bl.request_line_id WHERE bl.bill_id=? AND l.project_id=?',b.id,id).map(l=>({...l,amount:decimal(l.amount)}))}));
      const transactions=this.all('SELECT DISTINCT j.* FROM journals j JOIN journal_lines l ON l.journal_id=j.id WHERE l.project_id=? ORDER BY j.id DESC',id).map(j=>({...j,lines:this.all('SELECT l.*,a.name AS account,a.code,s.name AS source FROM journal_lines l JOIN accounts a ON a.id=l.account_id JOIN funding_sources s ON s.id=l.source_id WHERE l.journal_id=? AND l.project_id=?',j.id,id).map(l=>({...l,amount:decimal(l.amount)})),reversed:this.reversed(j.id)}));
      const result=this.enrichDashboard(actor,id,{project:{...p,activities:JSON.parse(p.activities)},metrics,budgets,sources,requests,bills,transactions});
      this.db.exec('COMMIT'); return result;
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  config(actor) {
    const u=this.user(actor); const result={user:u,accounts:this.all('SELECT * FROM accounts'),policies:this.all('SELECT * FROM approval_rules').map(p=>({...p,rules:JSON.parse(p.rules).map(r=>({...r,min:decimal(r.min),max:r.max===null?null:decimal(r.max)}))})),periods:this.all('SELECT * FROM periods')};
    if(u.admin) {
      result.users=this.all('SELECT id,name,email,admin FROM users');
      result.project_directory=this.all('SELECT id,code,name FROM projects');
      result.memberships=this.all('SELECT * FROM memberships'); result.reconciliations=this.all('SELECT * FROM reconciliations');
      result.cash_lines=this.all("SELECT l.id,l.account_id,l.amount,j.id AS journal_id,j.date,j.reference,p.code AS project,s.name AS source FROM journal_lines l JOIN journals j ON j.id=l.journal_id JOIN accounts a ON a.id=l.account_id LEFT JOIN projects p ON p.id=l.project_id LEFT JOIN funding_sources s ON s.id=l.source_id WHERE a.type IN('bank','cash','mobile') ORDER BY l.id DESC").map(l=>({...l,amount:decimal(l.amount)}));
    }
    return result;
  }
}
const base=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
const context={base,fail,text,date,parseMoney,cents,decimal,sum,today,split,hash,canonical};
Object.assign(ERP.prototype,lifecycleMethods(context),reconciliationMethods(context),reportMethods(context));
for(const name of ['listProjects','config','reconciliationOverview']) {
  const read=ERP.prototype[name];
  ERP.prototype[name]=function(...args){
    const nested=this.db.isTransaction;if(!nested)this.db.exec('BEGIN');
    try{const result=read.apply(this,args);if(!nested)this.db.exec('COMMIT');return result;}
    catch(e){if(!nested)this.db.exec('ROLLBACK');throw e;}
  };
}
const currentBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
const completionContext={...context,base:currentBase};
Object.assign(ERP.prototype,securityMethods(completionContext),completionMethods(completionContext),payrollMethods(completionContext),workflowMethods(completionContext),currencyMethods(completionContext));
const extensionBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,expandedPayrollMethods({...context,base:extensionBase}),inventoryMethods({...context,base:extensionBase}));
const hrBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,hrCoreMethods({...context,base:hrBase}),hrLeaveMethods({...context,base:hrBase}),hrPayrollMethods({...context,base:hrBase}));
const accountingBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,accountingCoreMethods({...context,base:accountingBase}));
const accountingCoreBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,accountingReportMethods({...context,base:accountingCoreBase}),fixedAssetMethods({...context,base:accountingCoreBase}));
const peopleBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,peopleCoreMethods({...context,base:peopleBase}),peopleRecruitmentMethods({...context,base:peopleBase}),peopleCaseMethods({...context,base:peopleBase}),peopleDevelopmentMethods({...context,base:peopleBase}),peopleEmploymentMethods({...context,base:peopleBase}),peoplePayrollMethods({...context,base:peopleBase}),peopleReportMethods({...context,base:peopleBase}));
const opsBase0=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,operationsEmploymentMethods({...context,base:opsBase0}));
const opsBase1=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,retentionMethods({...context,base:opsBase1}));
const opsBase2=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,statutoryPolicyMethods({...context,base:opsBase2}));
const opsBase3=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,providerMethods({...context,base:opsBase3}));
const releaseBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,releaseSecurityMethods({...context,base:releaseBase}));
Object.assign(ERP.prototype,projectListMethods({...context,base:{config:ERP.prototype.config}}));
const organizationBase=Object.fromEntries(Object.getOwnPropertyNames(ERP.prototype).filter(k=>k!=='constructor').map(k=>[k,ERP.prototype[k]]));
Object.assign(ERP.prototype,organizationFinanceMethods({...context,base:organizationBase}),organizationReportMethods({...context,base:organizationBase}));
Object.assign(ERP.prototype,dashboardMethods(context));
Object.assign(ERP.prototype,workspaceExperienceMethods(context));
for(const name of ['workspaceDashboard','dashboardRecords','dashboardBootstrap','dashboardJournal']){const read=ERP.prototype[name];ERP.prototype[name]=function(...args){const nested=this.db.isTransaction;if(!nested)this.db.exec('BEGIN');try{const result=read.apply(this,args);if(!nested)this.db.exec('COMMIT');return result;}catch(e){if(!nested)this.db.exec('ROLLBACK');throw e;}};}
for(const name of ['orgOverview','orgReport']){const read=ERP.prototype[name];ERP.prototype[name]=function(...args){const nested=this.db.isTransaction;if(!nested)this.db.exec('BEGIN');try{const result=read.apply(this,args);if(!nested)this.db.exec('COMMIT');return result;}catch(e){if(!nested)this.db.exec('ROLLBACK');throw e;}};}
for(const name of ['projectPage','listProjects','lifecycleOverview','departureClearance','config','projectExtras','hrOverview','myHR','inbox','foreignOverview','catalog','procurementDocument','integrationOverview','payslip','inventoryOverview','payrollPreview','payrollRegister','hrStageOverview','managedPayrollPreview','hrReports','leaveBalances','projectSalaryCosts','accountingOverview','accountingReport','controlReconciliation','periodChecklist','assetRegister']){
  const read=ERP.prototype[name];ERP.prototype[name]=function(...args){const nested=this.db.isTransaction;if(!nested)this.db.exec('BEGIN');try{const result=read.apply(this,args);if(!nested)this.db.exec('COMMIT');return result;}catch(e){if(!nested)this.db.exec('ROLLBACK');throw e;}};
}
