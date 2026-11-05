import {workspaceExperience,scopeBanner} from './workspace-experience.js';
import {workspaceNavigation} from './workspace-navigation.js';
import {loadWorkspaceData} from './workspace-data.js';
import {dashboardUI} from './dashboard-ui.js';
import {applicationShell} from './application-shell.js';
import {operationsUI} from './operations-ui.js';
import {organizationUI} from './organization-ui.js';
import {peopleUI} from './people-ui.js';
import { accountingUI } from './accounting-ui.js';
import { hrUI } from './hr-ui.js';
import { lifecycleUI } from './lifecycle-ui.js';
import { completionUI } from './completion-ui.js';
import { extensionsUI } from './extensions-ui.js';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:2}).format(Number(v||0));
const now = () => new Intl.DateTimeFormat('en-CA',{timeZone:state.config?.timezone||'Africa/Mogadishu',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const state = {view:'home',config:null,projects:[],details:new Map(),project:null,projectFilters:{page:1,page_size:20,q:'',status:'all'}};
const pendingKeys = new Map();
async function api(path,options={}) {
  const response=await fetch(`/api${path}`,{credentials:'same-origin',...options});
  const data=await response.json();
  if(!response.ok) { if(response.status===401 && path!=='/login' && path!=='/password/reset'){state.loadEpoch=(state.loadEpoch||0)+1;showLogin();} const e=new Error(data.error);e.status=response.status;throw e; } return data;
}
async function action(name,data) {
  const signature=JSON.stringify({action:name,data}),persist=!/^(password|mfa|user.create|integration.configure)/.test(name),digest=persist?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)))).map(n=>n.toString(16).padStart(2,'0')).join(''):null,storageKey=persist?'folio-pending:'+state.config.user.id+':'+digest:null;
  if(storageKey)try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved&&Date.now()-saved.created<86400000)pendingKeys.set(signature,saved.key);}catch{}
  if(!pendingKeys.has(signature)) pendingKeys.set(signature,crypto.randomUUID());
  if(storageKey)try{sessionStorage.setItem(storageKey,JSON.stringify({key:pendingKeys.get(signature),created:Date.now()}));}catch{}
  const result=await api('/actions',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':pendingKeys.get(signature)},body:signature});
  pendingKeys.delete(signature);if(storageKey)sessionStorage.removeItem(storageKey);return result;
}
let toastTimer;
function toast(message) { clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500); }
function showLogin() { state.view='home';state.dashboard=null;state.inbox=[];state.dashboardError=null;state.dashboardFilters=null;state.record=null;state.recordTarget=null;state.recordContext=null;state.setup=null;state.config&&shell.reset();dashboard.close(); state.registeredEmployee=null;state.organizationSubmittedDocument=null;state.organizationSubmittedBill=null; $('#content').replaceChildren();$('#modal-body').replaceChildren();if($('#modal').open)$('#modal').close();state.entitlementQuote=null; state.details.clear();state.projects=[];state.project=null;state.projectPage=null;state.projectFilters={page:1,page_size:20,q:'',status:'all'};state.work?.clear();state.inventory?.clear();state.accounting=null;state.organization=null;state.organizationReport=null;state.organizationFilters=null;state.organizationTab=null;state.resetToken=null; state.mfaSetup=null;state.recovery=null;state.payslip=null;state.hr=null;state.stageHR=null;state.hrReports=null;state.salaryCosts=null;state.printedRecord=null;state.selfHR=null;state.lifecycle=null; $('#workspace').classList.add('hidden');$('#login-view').classList.remove('hidden');state.config=null; }
function badge(value) { return `<span class="badge ${esc(value)}">${esc(value)}</span>`; }
function empty(message) { return `<div class="empty">${esc(message)}</div>`; }
function button(label,op,id,extra='') { return `<button class="small-button" data-op="${op}" data-id="${id}" ${extra}>${label}</button>`; }
function card(title,subtitle,body,tools='') { return `<section class="card"><div class="card-header"><div><h3>${title}</h3>${subtitle?`<p>${subtitle}</p>`:''}</div>${tools}</div>${body}</section>`; }
function moneyCells(row){return row.replace(/<td>(?=-?\$[0-9])/g,'<td class="number">');}
function table(headers,rows) { if(rows.length>50)return pagedTable(headers,rows); return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(moneyCells).join('')}</tbody></table></div>`; }
function pagedTable(headers,rows){return '<div class="paged-table" data-page="0"><label>Filter rows<input data-table-filter aria-label="Filter table rows" type="search"></label><div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map((r,i)=>i<50?moneyCells(r):moneyCells(r).replace('<tr','<tr hidden')).join('')+'</tbody></table></div><div class="toolbar table-pager"><button type="button" data-table-page="-1" disabled>Previous rows</button><span aria-live="polite" data-table-status>Rows 1-50 of '+rows.length+'</span><button type="button" data-table-page="1">Next rows</button></div></div>';}
function updateTable(box,delta=0){const term=box.querySelector('[data-table-filter]').value.toLowerCase(),rows=[...box.querySelector('tbody').rows],matching=rows.filter(r=>r.textContent.toLowerCase().includes(term)),pages=Math.max(1,Math.ceil(matching.length/50)),page=Math.max(0,Math.min(pages-1,Number(box.dataset.page)+delta));box.dataset.page=page;rows.forEach(r=>{r.hidden=true;r.dataset.filtered=String(!matching.includes(r));});matching.slice(page*50,page*50+50).forEach(r=>r.hidden=false);box.querySelector('[data-table-status]').textContent=matching.length?'Rows '+(page*50+1)+'-'+Math.min((page+1)*50,matching.length)+' of '+matching.length:'No matching rows';box.querySelector('[data-table-page="-1"]').disabled=page===0;box.querySelector('[data-table-page="1"]').disabled=page===pages-1;}
function current() { return state.details.get(state.project); }
function projectChoices(){const rows=state.projectPage?.projects||[],selected=current();state.projects=selected&&!rows.some(p=>p.id===state.project)?[...rows,{...selected.project,metrics:selected.metrics}]:rows;}
async function fetchProjectPage(){state.projectPage=await api('/projects?'+new URLSearchParams(state.projectFilters));projectChoices();}
async function loadProject(id,{view=state.view}={}){
  const actor=state.config?.user.id,epoch=state.loadEpoch;
  const extra=view==='work'?'work':view==='inventory'?'inventory':view==='salaryCosts'?'salary-costs':null;
  const [detail,data]=await Promise.all([api(`/projects/${id}`),extra?api(`/projects/${id}/${extra}`):null]);
  if(!state.config||state.config.user.id!==actor||state.loadEpoch!==epoch||state.project!==id)return;
  state.details=new Map([[id,detail]]);if(extra==='work')state.work=new Map([[id,data]]);if(extra==='inventory')state.inventory=new Map([[id,data]]);if(extra==='salary-costs')state.salaryCosts=new Map([[id,data]]);projectChoices();state.report=null;
}
async function allocationProject(id){if(!state.details.has(id)){const d=await api(`/projects/${id}`);if(!state.config)return null;state.details.set(id,d);}const keep=new Set([state.project,id,...[...document.querySelectorAll('#modal .line-editor [name=project_id]')].map(el=>Number(el.value))]);for(const key of state.details.keys())if(!keep.has(key))state.details.delete(key);return state.details.get(id);}
async function load() {
  const epoch=state.loadEpoch=(state.loadEpoch||0)+1,isCurrent=()=>state.loadEpoch===epoch;
  if(state.view==='recordDetail'&&state.config){await experience.loadRecord();if(isCurrent()&&state.config)render();return;}
  if(location.hash==='#register-employee')state.view='hrManagement';
  if(state.view==='home'&&location.hash!=='#register-employee'){
    const config=await api('/dashboard/bootstrap');if(!isCurrent())return;state.config=config;state.details.clear();state.projects=[];state.selfHR=null;state.stageHR=null;state.dashboardFilters??={};
    $('#login-view').classList.add('hidden');$('#workspace').classList.remove('hidden');workspaceChrome();syncNavigation(state.view,state);shell.update();
await Promise.all([dashboard.load(),experience.loadSetup()]);if(state.config&&isCurrent())render();return;
  }
  if(!$('#workspace').classList.contains('hidden'))$('#content').innerHTML='<div class="loading" role="status">Loading project workspace…</div>';
  const config=await api('/config');if(!isCurrent())return;state.config=config;
  if(!await loadWorkspaceData({state,api,now,loadProject,organization,accounting,lifecycle:peopleLifecycle,isCurrent}))return;
  if(!state.project&&state.config.accounting_roles.length&&state.view==='overview'){state.view='organizationFinance';await organization.load();if(!isCurrent())return;}state.report=null;
  $('#login-view').classList.add('hidden');$('#workspace').classList.remove('hidden');
  const u=state.config.user;$('#avatar').textContent=u.name.split(' ').slice(0,2).map(p=>p[0]).join('');
  $('#user-name').innerHTML=`${esc(u.name)}<small>${u.admin?'Administrator':'Project workspace'}</small>`;
  $('#workspace .local-tag').textContent=state.config.application_version?`v${state.config.application_version}`:'LOCAL';
  render();
  await openEmployeeRegistration();
}
async function openEmployeeRegistration(){
  if(location.hash!=='#register-employee'||!state.config)return;
  history.replaceState(null,'',location.pathname+location.search);
  state.view='hrManagement';state.hrTab='employees';render();
  if(!state.config.security.roles.includes('hr')){toast(`Signed in as ${state.config.user.email}. HR staff permission is required to register employees.`);return;}
  await extensions.perform('comp-employee','');
}
const viewNames={employeeLifecycle:'Employee lifecycle',accounting:'Organization accounting',hrManagement:'HR management',salaryCosts:'Project salary costs',inventory:'Warehouse inventory',compensation:'Compensation & benefits',catalog:'Supplier & item directory',work:'Payments & discussions',people:'People & payroll',inbox:'Notifications',security:'Account security',connections:'Integrations',overview:'Overview',projects:'Projects',budgets:'Budgets',funding:'Funding',spending:'Spending & approvals',advances:'Advances',reconciliation:'Reconciliation',reports:'Financial reports',closeout:'Project closeout',transactions:'Transaction ledger',settings:'Settings & controls'};
function header(title,subtitle,tools='') { return `<div class="page-header"><div><span class="eyebrow">ORGANIZATION WORKSPACE</span><h1>${title}</h1><p>${subtitle}</p></div><div class="toolbar">${tools}</div></div>`; }
function projectSelect() { return `<select id="project-select" aria-label="Select project">${state.projects.map(p=>`<option value="${p.id}" ${p.id===state.project?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select>`; }
function projectBanner(d) { return d?`<div class="banner"><span>◈</span><span>${d.project.demo?'<strong>Demonstration data</strong> · ':''}${esc(d.project.department)} · ${esc(d.project.start_date)} to ${esc(d.project.end_date)} · Your role: <strong>${esc(d.project.role)}</strong></span><span class="label">${esc(d.project.status).toUpperCase()} PROJECT</span></div>`:''; }
function metrics(d) {
  const m=d.metrics;
  const cards=[['Approved budget','approved','▤','Current approved version'],['Actual budget charges','actual','↗','Costs incurred, paid or unpaid'],['Outstanding commitments','commitment','⇄','Approved spending still to be charged'],['Remaining budget','remaining','◫','Budget less actuals and commitments']];
  const small=[['Funding promised','promised'],['Funding received','received'],['Cash available','cash'],['Unpaid liabilities','liability'],['Payments made','payments'],['Outstanding advances','advances']];
  return `<div class="metrics">${cards.map(([label,key,icon,note])=>`<div class="metric ${key==='remaining'?'accent':''}"><div class="metric-label">${label}<span class="metric-symbol">${icon}</span></div><div class="metric-value">${usd(m[key])}</div><div class="metric-note">${note}</div></div>`).join('')}</div><div class="minor-metrics">${small.map(([l,k])=>`<div class="minor-metric"><span>${l}</span><strong>${usd(m[k])}</strong></div>`).join('')}</div>`;
}
function transactionRows(d,limit) {
  return d.transactions.slice(0,limit||d.transactions.length).map(j=>{
    const debits=j.lines.filter(l=>Number(l.amount)>0).reduce((n,l)=>n+Number(l.amount),0);
    return `<tr><td><strong>${esc(j.reference)}</strong><small>${esc(j.description)}</small></td><td>${esc(j.date)}</td><td>${badge(j.reversed?'reversed':j.kind)}</td><td class="number">${usd(debits)}</td><td>${j.kind==='receipt'?recordLink('receipt',j.id,d.project.id):''}<details class="drill-down"><summary>View journal</summary><p class="muted">Posted by user #${j.actor_id}${j.reversal_of?` · Reverses journal #${j.reversal_of}`:''}</p>${table(['Line / account','Source','Debit','Credit'],j.lines.map(l=>`<tr><td>#${l.id} · ${esc(l.code)} · ${esc(l.account)}</td><td>${esc(l.source)}</td><td class="number">${Number(l.amount)>0?usd(l.amount):'—'}</td><td class="number">${Number(l.amount)<0?usd(-Number(l.amount)):'—'}</td></tr>`))}${lifecycle.links(j.documents)}${d.project.role==='finance'&&d.project.status==='active'&&!j.reversed&&!j.reversal_of?button('Linked reversal','reverse',j.id):''}</details></td></tr>`;
  });
}
function overview(d) {
  const m=d.metrics,total=Number(m.approved)||1;
  const bars=[['Actual costs',m.actual,'','Accepted expenditure charged to the budget'],['Outstanding commitments',m.commitment,'bar-amber','Unbilled purchase orders and approved reservations'],['Remaining budget',m.remaining,'bar-blue','Available authority for new spending']];
  const budgetBody=`<div class="card-body">${bars.map(([l,v,c,n])=>`<div class="budget-bar ${c}"><div class="bar-label"><span>${l}</span><strong>${usd(v)}</strong></div><progress value="${Math.max(0,Number(v))}" max="${total}" aria-label="${l}"></progress><div class="bar-note">${n}</div></div>`).join('')}</div><div class="equation"><span>Approved − actual − commitments</span><strong>${usd(m.remaining)} remaining</strong></div>`;
  const fundBody=`<div class="card-body">${d.sources.length?d.sources.map(s=>`<div class="fund-row"><span class="fund-icon">↓</span><div class="fund-name">${esc(s.name)}<small>${esc(s.type)} · ${s.categories.length?esc(s.categories.join(', ')):'All categories'}</small></div><strong>${usd(s.cash)}</strong></div>`).join(''):empty('Add a funding source to record receipts.')}<p class="muted">Project allocations share the organization's bank accounts. Promises do not increase cash.</p></div>`;
  return metrics(d)+`<div class="columns">${card('Budget utilization','Spending authority, independent of received cash',budgetBody,`<button class="link-button" data-view="budgets">View budget →</button>`)}${card('Funding & cash','Cash currently allocated by source',fundBody,`<button class="link-button" data-view="funding">View funding →</button>`)}</div>`+card('Recent financial transactions','Select a journal to inspect the debit and credit entries',d.transactions.length?table(['Reference & description','Date','Type','Posted amount','Details'],transactionRows(d,5)):empty('No financial transactions yet.'),`<button class="link-button" data-view="transactions">View ledger →</button>`);
}
function projects() {
  const page=state.projectPage,p=page.pagination,f=state.projectFilters;
  return header('Projects','A dedicated budget and funding trail for every initiative.',`<button class="primary" data-op="project">＋ New project</button>`)+`<form id="project-filters" class="report-filters"><label>Find project<input name="q" maxlength="100" value="${esc(f.q)}" placeholder="Code, name or department"></label>${select('status','Status',[['all','All'],['active','Active'],['closed','Closed']],f.status)}${select('page_size','Projects per page',[['20','20'],['50','50']],f.page_size)}<button type="submit">Search projects</button></form><div class="toolbar"><button data-project-page="-1" ${p.has_previous?'':'disabled'}>Previous projects</button><span role="status">Page ${p.page} of ${Math.max(1,p.total_pages)} · ${p.total} matching projects</span><button data-project-page="1" ${p.has_next?'':'disabled'}>Next projects</button></div><div class="project-grid">${page.projects.map(p=>`<section class="card project-card"><div class="toolbar">${badge(p.status)}${p.demo?'<span class="muted">Demo project</span>':''}</div><h2>${esc(p.name)}</h2><span class="eyebrow">${esc(p.code)}</span><p>${esc(p.description)}</p><div class="project-detail"><span>${esc(p.department)}</span><span>${esc(p.role)} access</span></div><div class="bar-label"><span>Remaining budget</span><strong>${usd(p.metrics.remaining)}</strong></div><progress value="${Math.max(0,Number(p.metrics.remaining))}" max="${Math.max(1,Number(p.metrics.approved))}" aria-label="Remaining budget"></progress><div class="project-bottom"><span class="muted">Cash ${usd(p.metrics.cash)}</span><button class="small-button" data-open-project="${p.id}">Open project →</button></div></section>`).join('')}</div>${!page.projects.length?empty('No matching project memberships. Change the search or ask an administrator for access.'):''}`;
}
function canApprove(d){return ['manager','finance'].includes(d.project.role)||(state.config.delegations||[]).some(a=>a.delegate_id===state.config.user.id&&a.project_id===d.project.id&&!a.revoked&&a.start_date<=now()&&a.end_date>=now());}
function budgets(d) {
  return `<p class="section-note">The latest approved version controls spending. Original and amended budgets remain in the version history. Transfers use a complete new version with a recorded rationale.</p>`+d.budgets.map(b=>card(`Version ${b.version} · ${esc(b.reason)}`,`Submitted ${esc(b.created_at)} · ${b.previous_id?`Replaces budget #${b.previous_id}`:'Original budget'}`,table(['Category','Activity','Eligible period','Amount'],b.lines.map(l=>`<tr><td><strong>${esc(l.category)}</strong></td><td>${esc(l.activity)}</td><td>${esc(l.start_date)} → ${esc(l.end_date)}</td><td class="number">${usd(l.amount)}</td></tr>`))+`<div class="table-footer"><span>Approval history: ${b.approvals.map(a=>esc(a.name)).join(' → ')||'Awaiting independent approval'}</span><strong>${usd(b.lines.reduce((n,l)=>n+Number(l.amount),0))}</strong></div>`,`<div class="toolbar">${badge(b.state)}${b.state==='submitted'&&canApprove(d)?button('Approve','approve-budget',b.id):''}</div>`)).join('')+(d.budgets.length?'':empty('No budgets submitted. Start with the original project budget.'));
}
function funding(d) {
  return metrics(d)+card('Funding sources','Eligibility is checked on each spending allocation',d.sources.length?table(['Source','Type','Allowed categories','Eligible dates','Cash allocated'],d.sources.map(s=>`<tr><td><strong>${esc(s.name)}</strong><small>Source #${s.id}</small></td><td>${esc(s.type)}</td><td>${esc(s.categories.join(', ')||'All categories')}</td><td>${esc(s.start_date)} → ${esc(s.end_date)}</td><td class="number">${usd(s.cash)}</td></tr>`)):empty('No sources configured.'),['manager','finance'].includes(d.project.role)?button('＋ Add source','source',d.project.id):'')+card('Funding movements','Receipts and reversals appear in the accounting ledger',table(['Reference & description','Date','Type','Posted amount','Details'],transactionRows({...d,transactions:d.transactions.filter(j=>j.kind==='receipt'||j.kind==='transfer'||j.kind==='reversal')})));
}
const recordLink=(kind,id,project)=>`<button type="button" data-record-open="${kind}" data-record-id="${id}" data-record-project="${project}">View details</button>`;
function spending(d) {
  const manager=['manager','finance'].includes(d.project.role),finance=d.project.role==='finance';
  const requests=d.requests.map(r=>{
    const remaining=r.lines.reduce((n,l)=>n+Number(l.remaining),0);
    let tools=r.mode==='payroll'?'':recordLink('request',r.id,d.project.id);
    if(r.state==='submitted'&&canApprove(d)&&r.mode!=='payroll') tools+=button('Approve','approve-request',r.id);
    if(r.state==='approved'&&manager&&!r.po&&!r.advance&&r.kind!=='advance'&&!r.mode&&d.project.operational_state==='open') tools+=button('Create PO','po',r.id);
    if(r.state==='approved'&&finance&&!r.po&&!r.advance&&!r.mode) tools+=button('Issue advance','advance',r.id);
    if(r.po)tools+=button('Print PO','print-po',r.po.id);
    if(r.po&&r.state==='approved'&&finance&&remaining>0) tools+=button('Record bill','bill',r.po.id);
    if(r.advance&&finance) tools+=button('Settle / return','settle',r.advance.id);
    if(r.creator_id===state.config.user.id&&r.state!=='cancelled'&&!r.po&&!r.advance) tools+=button('Revise','edit-request',r.id);
    if(manager&&r.state!=='cancelled') tools+=button('Cancel remainder','cancel-request',r.id,'class="danger-button"');
    return `<tr><td><strong>${esc(r.title)}</strong><small>Request #${r.id} · ${r.po?`PO ${esc(r.po.reference)}`:r.advance?'Advance issued':'Purchase reservation'}${r.supersedes_id?` · Replaces #${r.supersedes_id}`:''}</small></td><td>${esc(r.date)}</td><td>${badge(r.state)}<small>${r.approvals.map(a=>esc(a.name)).join(' → ')||'Awaiting approval'}</small></td><td class="number">${usd(r.lines.reduce((n,l)=>n+Number(l.amount),0))}<small>${usd(remaining)} reserved</small></td><td><details class="drill-down"><summary>Allocations</summary>${r.lines.map(l=>`<p>${esc(l.category)} / ${esc(l.activity)} · Source #${l.source_id} · ${usd(l.amount)}</p>`).join('')}</details><div class="actions">${tools}</div></td></tr>`;
  });
  const bills=d.bills.map(b=>`<tr><td><strong>${esc(b.invoice)}</strong><small>${esc(b.supplier)} · Bill #${b.id}</small></td><td>${esc(b.date)}</td><td>${badge(b.reversed?'reversed':Number(b.unpaid)>0?'bill':'approved')}</td><td class="number">${usd(b.lines.reduce((n,l)=>n+Number(l.amount),0))}</td><td class="number">${usd(b.unpaid)}</td><td>${recordLink('bill',b.id,d.project.id)}${finance&&b.can_pay&&Number(b.total_unpaid)>0?button('Pay bill','pay',b.id):''}</td></tr>`);
  return `<p class="section-note">Final approval reserves budget. A bill turns the billed portion into an actual charge; a payment only clears the liability and reduces cash. Mixed-project documents require permission on every participating project.</p>`+card('Spending requests','Reservations, purchase orders and advances',requests.length?table(['Request','Date','Status & approvals','Requested amount','Actions'],requests):empty('No spending requests yet.'))+card('Supplier bills','Track partial billing and unpaid balances',bills.length?table(['Invoice / supplier','Date','Status','Actual charges','Unpaid','Actions'],bills):empty('Create a purchase order, then record its first supplier bill.'));
}
function settings() {
  const c=state.config;
  let html=header('Settings & controls','Financial policy is explicit, configurable and recorded.',`<button id="settings-logout">Sign out</button>`)+`<div class="banner"><span>◈</span><span><strong>Local milestone.</strong> Organization approval thresholds, deployment checks and statutory HR policies must be verified before rollout.</span></div>`;
  html+=`<div class="setting-grid">${c.policies.map(p=>card(`${esc(p.kind)} approval policy`,'Thresholds apply to new submissions; in-flight policies are preserved',`<div class="card-body"><pre class="policy-box">${esc(JSON.stringify(p.rules,null,2))}</pre></div>`,c.user.admin?button('Configure','policy',p.kind):'')).join('')}</div>`;
  html+=card('Accounting periods','Closed periods reject financial postings',table(['From','To','State'],c.periods.map(p=>`<tr><td>${p.start_date}</td><td>${p.end_date}</td><td>${badge(p.state)}</td></tr>`)),c.user.admin?button('Configure period','period',''):'' );
  html+=card('Cash accounts','Shared bank, cash and mobile-money accounts',table(['Code','Account','Type'],c.accounts.filter(a=>['bank','cash','mobile'].includes(a.type)).map(a=>`<tr><td>${esc(a.code)}</td><td>${esc(a.name)}</td><td>${esc(a.type)}</td></tr>`)),c.user.admin?`<div class="toolbar">${button('Add account','account','')}<button data-view="reconciliation">Statement matching</button>${button('Authorize correction','correction-authorize','')}</div>`:'');
  if(c.user.admin) html+=card('Users & project access','Finance membership is granted by an administrator',table(['User','Email','Organization role'],c.users.map(u=>`<tr><td>${esc(u.name)} · #${u.id}</td><td>${esc(u.email)}</td><td>${u.admin?'Administrator':'User'}</td></tr>`)),`<div class="toolbar">${button('New user','user','')}${button('Assign access','membership','')}</div>`);
  if(c.user.admin) html+=card('Organization cash ledger','All project allocations in shared cash accounts; use line IDs when reconciling outstanding items',table(['Line ID','Date','Reference','Project / source','Account','Cash movement'],c.cash_lines.map(l=>`<tr><td>#${l.id}</td><td>${l.date}</td><td>${esc(l.reference)}</td><td>${esc(l.project)}<small>${esc(l.source)}</small></td><td>${esc(c.accounts.find(a=>a.id===l.account_id)?.name)}</td><td class="number">${usd(l.amount)}</td></tr>`)));
  html+=card('Delivery scope','Project financial lifecycle',`<div class="card-body"><p class="section-note">Implemented: approved budget amendments/transfers with evidence, advance requests/approval/disbursement/receipts/returns/overdue tracking, statement entry/CSV import/partial matching/review, supplier credits/refunds, controlled locked-period corrections, financial reports/CSV/print, operational completion, financial closeout exceptions and authorized reopening.</p><p class="section-note">Additional workflows include comments, delegation, independent payment vouchers, direct expenses, monthly payroll, donor award ceilings and configured integrations. All finances use USD. Production activation still requires verified payroll rules, authorized business policies and live provider and hosting checks.</p></div>`);
  return html;
}
function render() {
  syncNavigation(state.view,state);shell.update();
  if(state.view==='recordDetail'){$('#content').innerHTML=experience.renderRecord();$('#breadcrumb').textContent='Workspace / Record details';return;}
  if(state.view==='home'){$('#content').innerHTML=dashboard.render();$('#breadcrumb').textContent='Overview / Dashboard';return;}
  const organizationPage=organization.render();if(organizationPage!==null){$('#content').innerHTML=organizationPage;$('#breadcrumb').textContent='Workspace / Organization Finance & Accounting';return;}
  const peoplePage=peopleLifecycle.render();if(peoplePage!==null){$('#content').innerHTML=peoplePage+operations.render();$('#breadcrumb').textContent='Workspace / Employee lifecycle';return;}
  const accounts=accounting.render();if(accounts!==null){$('#content').innerHTML=accounts;$('#breadcrumb').textContent='Workspace / Organization accounting';return;}
  const managed=hr.render();if(managed!==null){$('#content').innerHTML=managed;$('#breadcrumb').textContent=`Workspace / ${viewNames[state.view]}`;return;}
  const extended=extensions.render();if(extended!==null){$('#content').innerHTML=extended;$('#breadcrumb').textContent=`Workspace / ${viewNames[state.view]}`;return;}
  const completed=completion.render();if(completed!==null){$('#content').innerHTML=completed+completion.privateCards();$('#breadcrumb').textContent=`Workspace / ${viewNames[state.view]}`;return;}
  $('#breadcrumb').textContent=`Workspace / ${viewNames[state.view]}`;
  
  if(state.view==='projects') { $('#content').innerHTML=projects();return; }
  if(state.view==='settings') { $('#content').innerHTML=settings();return; }
  if(state.view==='reconciliation') { $('#content').innerHTML=lifecycle.reconciliation();return; }
  const d=current(); if(!d) { $('#content').innerHTML=header('Your project workspace','Create a project to begin tracking its budget and funding.',`<button class="primary" data-op="project">＋ New project</button>`)+empty('No projects available for this account.');return; }
  const manager=['manager','finance'].includes(d.project.role),finance=d.project.role==='finance',writable=d.project.status==='active';
  let tools=projectSelect();
  if(writable && d.project.operational_state==='open'&&state.view==='overview') tools+=`<button class="primary" data-op="request">＋ Request spending</button>`;
  if(writable && state.view==='budgets'&&manager) tools+=`<button class="primary" data-op="budget">＋ Submit budget version</button>`;
  if(writable && state.view==='funding'&&finance) tools+=`${button('Record promise','promise','')}${button('Return funds','funding-return','')}${d.promises.length?button('Cancel promise','promise-cancel',''):''}<button class="primary" data-op="receipt">↓ Record receipt</button>`;
  if(writable && d.project.operational_state==='open'&&state.view==='spending'&&d.project.role!=='viewer') tools+=`<button class="primary" data-op="request">＋ Spending request</button>`;
  if(writable && state.view==='transactions'&&finance) tools+=`${button('Internal transfer','transfer','')}${button('Authorize exception','exception','')}`;
  if(state.view==='advances'&&writable&&d.project.operational_state==='open'&&d.project.role!=='viewer')tools+=`<button class="primary" data-op="advance-request">＋ Advance request</button>`;
  if(state.view==='reports')tools+=`<button data-op="print-report">Print statement</button>`;
  const titles={overview:'Project overview',budgets:'Project budgets',funding:'Funding & cash',spending:'Spending & approvals',transactions:'Transaction ledger',advances:'Employee & supplier advances',reports:'Project financial statement',closeout:'Project closeout'};
  let html=header(titles[state.view],esc(d.project.name),tools)+projectBanner(d);
  if(state.view==='overview') html+=overview(d)+card('Warehouse inventory','Purchase costs are charged on the bill; inventory movements preserve that budget charge.',`<div class="card-body"><p>On-hand inventory ${usd(d.metrics.inventory)} | Count variance ${usd(d.metrics.inventory_variance)}</p><button data-view="inventory">View stock lots and movements</button></div>`);
  if(state.view==='budgets') html+=lifecycle.budgetTools(d)+budgets(d);
  if(state.view==='funding') html+=funding(d);
  if(state.view==='spending') html+=spending(d);
  if(state.view==='transactions') html+=metrics(d)+card('Posted journals','Balanced entries with project and funding-source dimensions',d.transactions.length?table(['Reference & description','Date','Type','Posted amount','Drill-down'],transactionRows(d)):empty('No financial transactions yet.'));
  if(state.view==='advances')html+=lifecycle.advances(d);
  if(state.view==='reports')html+=lifecycle.reports(d);
  if(state.view==='closeout')html+=lifecycle.closeout(d);
  if(state.view==='overview')html+=lifecycle.financialExtras(d);
  if(state.view==='spending')html+=lifecycle.credits(d);
  if(writable && d.project.role==='manager'&&state.view!=='closeout') html+=`<div class="toolbar"><span class="muted">Review obligations and reconciliation before closing.</span><button data-view="closeout">Closeout checklist →</button></div>`;
  $('#content').innerHTML=html;
}
function field(name,label,type='text',value='',attrs='') { return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs} required></label>`; }
function select(name,label,options,value) { return `<label>${label}<select name="${name}">${options.map(([id,label])=>`<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`; }
const cashOptions=()=>state.config.accounts.filter(a=>['bank','cash','mobile'].includes(a.type)).map(a=>[a.id,`${a.name} (${a.code})`]);
const sourceOptions=d=>d.sources.map(s=>[s.id,s.name]);
const amountField=(name='amount',value='')=>field(name,'Amount (USD)','text',value,'inputmode="decimal" placeholder="0.00" pattern="[0-9]+(\\.[0-9]{1,2})?"');
const dateField=(value=now())=>field('date','Posting / eligible date','date',value);
const referenceField=label=>field('reference',label||'Unique reference','text','', 'maxlength="100"');
let submitHandler=null;
function modal(title,body,handler,submit='Save') {
  if((['Request spending','Revise spending request','Request an employee or supplier advance','Record funding received','Request scheduled leave','Record a partial supplier bill','Issue an advance','Settle or return advance'].includes(title)||title.startsWith('Pay ')&&submit==='Post payment')&&!body.includes('workflow-steps'))return experience.reviewedModal(title,body,handler,submit);
  $('#action-form').workflowCleanup?.();$('#action-form').noValidate=false;
  $('#modal-title').textContent=title;$('#modal-body').innerHTML=body;$('#form-error').textContent='';$('#submit-action').textContent=submit;$('#submit-action').disabled=false;submitHandler=handler;$('#modal').showModal();
}
function allocations(type,lines=[]) {
  const d=current(),defaultLine=type==='budget'?{activity:d.project.activities[0],start_date:d.project.start_date,end_date:d.project.end_date}:{project_id:d.project.id,source_id:d.sources[0]?.id,activity:d.project.activities[0]};
  const initial=lines.length?lines:[defaultLine];
  return `<div id="allocation-lines" data-type="${type}">${initial.map((l,i)=>lineHTML(type,l,i)).join('')}</div><button type="button" class="add-line" id="add-line">＋ Add allocation line</button>`;
}
function lineHTML(type,line,index) {
  const d=state.details.get(Number(line.project_id))||current();
  let fields='';
  if(type==='request'||type==='hrAllocation') fields+='<label>Find allocation project<input type="search" data-allocation-project-query maxlength="100" placeholder="Code, name or department"></label><button type="button" data-allocation-project-search>Search allocation projects</button>'+select('project_id','Project',state.projects.filter(p=>p.status==='active'&&(type==='hrAllocation'||p.role!=='viewer')).map(p=>[p.id,p.name]),d.project.id)+select('source_id','Funding source',sourceOptions(d),line.source_id);
  fields+=field('category','Budget category','text',line.category||'','maxlength="80"')+select('activity','Activity',d.project.activities.map(a=>[a,a]),line.activity);
  if(type==='budget') fields+=field('start_date','Period from','date',line.start_date||d.project.start_date)+field('end_date','Period to','date',line.end_date||d.project.end_date);
  fields+=type==='hrAllocation'?field('amount','Allocation percent','text',line.amount||'','inputmode="decimal" pattern="[0-9]+(\\.[0-9]{1,4})?"'):amountField('amount',line.amount||'');
  return `<div class="line-editor"><div class="line-title">Allocation ${index+1}<button type="button" data-remove-line>Remove</button></div><div class="field-grid">${fields}</div></div>`;
}
function readLines() { return [...$('#allocation-lines').children].map(row=>Object.fromEntries([...row.querySelectorAll('input[name],select[name]')].map(el=>[el.name,['project_id','source_id'].includes(el.name)?Number(el.value):el.value]))); }
function dataOf(form) { return Object.fromEntries([...new FormData(form)].filter(([,v])=>!(v instanceof File))); }
const lifecycle=lifecycleUI({state,api,action,esc,usd,now,card,table,empty,button,field,select,amountField,dateField,referenceField,modal,allocations,readLines,dataOf,current,projectSelect,header,toast,refreshView:render});
const completion=completionUI({state,api,action,esc,usd,now,card,table,empty,button,field,select,amountField,dateField,referenceField,modal,allocations,readLines,dataOf,current,projectSelect,header,lifecycle});
const extensions=extensionsUI({state,api,action,esc,usd,now,card,table,empty,button,field,select,amountField,dateField,referenceField,modal,allocations,readLines,dataOf,current,projectSelect,header,lifecycle});
const accounting=accountingUI({state,api,action,esc,usd,now,card,table,empty,button,field,select,modal,dataOf,header,toast,refreshView:render});
const organization=organizationUI({accountingLoad:accounting.load,state,api,action,esc,usd,now,card,table,empty,button,field,select,modal,dataOf,header,toast,refreshView:render});
const experience=workspaceExperience({state,api,action,esc,usd,now,modal,field,select,dataOf,navigate:navigateTo,refreshView:render,perform,toast});
const dashboard=dashboardUI({state,api,esc,usd,now,navigate:navigateTo,refreshView:render,setup:experience.setup});
const hr=hrUI({state,api,action,esc,usd,now,card,table,empty,button,field,select,modal,allocations,readLines,dataOf,projectSelect,header,extensions,toast,refreshView:render});
const operations=operationsUI({state,api,action,esc,usd,now,card,table,empty,button,field,select,modal,dataOf,header,toast,refreshView:render});
const peopleLifecycle=peopleUI({state,api,action,esc,usd,now,card,table,empty,button,field,select,modal,dataOf,header,toast,refreshView:render});
async function perform(op,id) {
  if(await organization.perform(op,id))return;
  if(op==='reset-password-complete'){modal('Reset password',field('token','Administrator-issued reset token','password')+field('new_password','New password (12 characters minimum)','password','','minlength="12"'),async form=>{await api('/password/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dataOf(form))});state.publicResetCompleted=true;});return;}
  if(await operations.perform(op,id))return;
  if(await peopleLifecycle.perform(op,id))return;
  if(await accounting.perform(op,id))return;
  if(await hr.perform(op,id))return;
  if(await extensions.perform(op,id))return;
  if(await completion.perform(op,id))return;
  if(await lifecycle.perform(op,id))return;
  const d=current(),p=d?.project,request=d?.requests.find(r=>r.id===Number(id));
  const financeFields=()=>`<div class="field-grid">${select('source_id','Funding source',sourceOptions(d))}${select('account_id','Cash account',cashOptions())}${amountField()}${dateField()}</div>${referenceField()}`;
  switch(op) {
    case 'project': experience.reviewedModal('Create a project',`<div class="field-grid">${field('code','Unique project code')}${field('name','Project name')}${field('department','Department')}${field('start_date','Start date','date',`${now().slice(0,4)}-01-01`)}${field('end_date','End date','date',`${now().slice(0,4)}-12-31`)}${field('activities','Activities (comma separated)','text','General')}</div><label>Description<textarea name="description" required></textarea></label>`,async form=>{const v=dataOf(form);v.activities=v.activities.split(',').map(a=>a.trim());const r=await action('project.create',v);state.project=r.id;state.view='overview';});break;
    case 'budget': {
      const prior=d.budgets.find(b=>b.state==='approved');
      modal(prior?'Submit budget amendment':'Submit original budget',`<p class="section-note">Submit a complete replacement budget. A different authorized user must approve it.</p>${prior?select('change_kind','Amendment type',[['increase','Increase total budget'],['reduction','Reduce total budget'],['reallocation','Reallocate without changing total']]):''}<label>Rationale / amendment explanation<textarea name="reason" required></textarea></label>${allocations('budget',prior?.lines||[])}${lifecycle.files()}`,async form=>action(prior?'budget.amend':'budget.submit',{...dataOf(form),project_id:p.id,lines:readLines(),documents:await lifecycle.readDocuments(form)}),'Submit for approval');break;
    }
    case 'approve-budget': modal('Approve budget',`<p class="section-note">This records your approval under the policy snapshotted at submission. Approval does not record funding or change cash.</p>`,()=>action('budget.approve',{id:Number(id)}),'Record approval');break;
    case 'source': modal('Add a funding source',`<div class="field-grid">${field('name','Source name')}${select('type','Source type',[['donor','External donor'],['organization','Organization funds']])}${field('start_date','Eligible from','date',p.start_date)}${field('end_date','Eligible through','date',p.end_date)}</div><label>Allowed categories (comma separated, blank = all)<input name="categories"></label>`,form=>{const v=dataOf(form);v.categories=v.categories.split(',').map(c=>c.trim()).filter(Boolean);return action('source.create',{...v,project_id:p.id});});break;
    case 'receipt': modal('Record funding received',financeFields()+(state.config.accounting_enabled?select('treatment','Approved funding policy treatment',[['deferred','Deferred liability'],['refundable','Refundable liability'],['income','Recognized income']])+'<p>Configure and independently approve the source recognition policy in Organization accounting before posting.</p>':''),form=>{const v=dataOf(form);return action('funding.receive',{...v,source_id:Number(v.source_id),account_id:Number(v.account_id)});},'Post receipt');break;
    case 'promise': modal('Record funding promised',`<div class="field-grid">${select('source_id','Funding source',sourceOptions(d))}${amountField()}${dateField()}</div>${referenceField('Award / promise reference')}`,form=>{const v=dataOf(form);return action('funding.promise',{...v,source_id:Number(v.source_id)});});break;
    case 'request': case 'edit-request': modal(op==='request'?'Request spending':'Revise spending request',`<p class="section-note">Each allocation needs an approved category, activity and funding source. ${op==='edit-request'?'Replacing this request releases its reservation and requires approval again.':''}</p>${field('title','Purpose / description','text',request?.title||'')}${dateField(request?.date||now())}${allocations('request',request?.lines||[])}`,form=>action(op==='request'?'request.submit':'request.edit',{...dataOf(form),lines:readLines(),...(request?{id:request.id}:{})}),'Submit for approval');break;
    case 'approve-request': modal('Approve spending request',`<p class="section-note">Final approval reserves the requested budget atomically. Insufficient category/period budget blocks approval unless an authorized exception covers it. You cannot approve your own request.</p>`,()=>action('request.approve',{id:Number(id)}),'Record approval');break;
    case 'cancel-request': modal('Cancel remaining commitment','<p class="section-note">Only the unused commitment is released. Posted bills and payments remain.</p><label>Cancellation reason<textarea name="reason" required></textarea></label>',form=>action('request.cancel',{id:Number(id),reason:dataOf(form).reason}),'Cancel remainder');break;
    case 'po': modal('Create purchase order',`<p class="section-note">The approved reservation becomes a purchase commitment without consuming budget again.</p>${select('supplier_id','Registered supplier (optional)',[['','Enter supplier name'],...(state.catalog?.suppliers||[]).filter(s=>s.state==='active').map(s=>[s.id,s.name])])}${field('supplier','Supplier name (for manual entry)').replace(' required','')}${referenceField('Purchase order reference')}${dateField()}`,form=>{const v=dataOf(form);return action('po.create',{...v,supplier_id:v.supplier_id?Number(v.supplier_id):undefined,request_id:Number(id)});},'Create purchase order');break;
    case 'bill': {
      const r=d.requests.find(r=>r.po?.id===Number(id));
      modal('Record a partial supplier bill',`<div class="field-grid">${field('invoice','Supplier invoice reference')}${dateField()}${field('due_date','Payment due date','date',p.end_date)}${select('cost_type','Accounting classification',[['expense','Expense'],['asset','Capital asset']])}</div><p class="section-note">Enter only the billed amount per allocation. Leave other lines blank. Charges cannot exceed outstanding commitments.</p>${r.lines.filter(l=>Number(l.remaining)>0).map(l=>`<label>${esc(l.category)} · ${esc(l.activity)} — ${usd(l.remaining)} available<input name="line-${l.id}" inputmode="decimal" placeholder="0.00"></label>`).join('')}${lifecycle.files()}`,async form=>{const v=dataOf(form);return action('bill.post',{po_id:Number(id),invoice:v.invoice,date:v.date,due_date:v.due_date,cost_type:v.cost_type,lines:r.lines.map(l=>({request_line_id:l.id,amount:v[`line-${l.id}`]})).filter(l=>l.amount&&Number(l.amount)>0),documents:await lifecycle.readDocuments(form)});},'Post bill');break;
    }
    case 'pay': {
      const bill=d.bills.find(b=>b.id===Number(id));
      modal(`Pay ${bill.invoice}`,`<p class="section-note">Full invoice unpaid balance: ${usd(bill.total_unpaid)}. Split-project payments follow the remaining invoice allocations. This payment reduces cash and the liability without recording the cost again.</p><div class="field-grid">${amountField('amount',bill.total_unpaid)}${select('account_id','Pay from',cashOptions())}${dateField()}</div>${referenceField('Unique bank / payment reference')}`,form=>{const v=dataOf(form);return action('payment.post',{...v,account_id:Number(v.account_id),bill_id:Number(id)});},'Post payment');break;
    }
    case 'advance': modal('Issue an advance',`<p class="section-note">The full approved request is issued as an advance. The approved beneficiary and due date are preserved. Cash reduces once; supported settlement creates cost later.</p>${field('beneficiary','Employee / supplier beneficiary','text',request?.terms?.beneficiary||'')}<div class="field-grid">${select('beneficiary_type','Beneficiary type',[['employee','Employee'],['supplier','Supplier']],request?.terms?.beneficiary_type)}${field('due_date','Settlement due date','date',request?.terms?.due_date||p.end_date)}${select('account_id','Pay from',cashOptions())}${dateField()}</div>${referenceField()}`,form=>{const v=dataOf(form);return action('advance.issue',{...v,account_id:Number(v.account_id),request_id:Number(id)});},'Issue advance');break;
    case 'settle': {
      const r=d.requests.find(r=>r.advance?.id===Number(id));
      modal('Settle or return advance',`<p class="section-note">Accepted expenditure requires supporting receipts for new advance requests. Unused returns release their reservation automatically and do not create expenditure.</p><div class="field-grid">${select('kind','Movement',[['settle','Accept expenditure'],['return','Return unused cash']])}${select('request_line_id','Allocation',r.lines.map(l=>[l.id,`${l.category} / ${l.activity}`]))}${amountField()}${dateField()}${select('account_id','Cash return account (returns only)',cashOptions())}</div>${referenceField()}<label>Accepted supporting evidence / return reason<textarea name="evidence" required></textarea></label>${lifecycle.files()}`,async form=>{const v=dataOf(form);const kind=v.kind;delete v.kind;return action(kind==='settle'?'advance.settle':'advance.return',{...v,advance_id:Number(id),request_line_id:Number(v.request_line_id),account_id:Number(v.account_id),documents:await lifecycle.readDocuments(form)});},'Post movement');break;
    }
    case 'reverse': modal('Create linked reversal',`<p class="section-note">A new journal records the opposite entries and preserves the original. Reverse dependent refunds, credits or settlements first. Locked-period corrections require independent authority and an open posting period.</p>${referenceField()}${dateField()}${select('authorization_id','Locked-period correction authority',[['','Original period open — no special authority'],...(state.config.correction_authorizations||[]).filter(a=>a.journal_id===Number(id)&&a.poster_id===state.config.user.id).map(a=>[a.id,`#${a.id} ${a.reason} / ${a.expiry}`])])}<label>Correction reason<textarea name="reason" required></textarea></label>${lifecycle.files()}`,async form=>{const v=dataOf(form);return action('journal.reverse',{...v,id:Number(id),authorization_id:v.authorization_id?Number(v.authorization_id):undefined,documents:await lifecycle.readDocuments(form)});},'Post reversal');break;
    case 'transfer': modal('Internal cash transfer',`<div class="field-grid">${select('source_id','Project funding source',sourceOptions(d))}${select('from_account_id','From account',cashOptions())}${select('to_account_id','To account',cashOptions(),2)}${amountField()}${dateField()}</div>${referenceField()}`,form=>{const v=dataOf(form);return action('cash.transfer',{...v,source_id:Number(v.source_id),from_account_id:Number(v.from_account_id),to_account_id:Number(v.to_account_id)});},'Post transfer');break;
    case 'exception': modal('Authorize a budget exception',`<p class="section-note">Explicit project authority for a maximum total category overrun. It does not relax source eligibility, approval independence or available cash.</p><div class="field-grid">${amountField()}${field('expiry','Authority expires','date',p.end_date)}</div><label>Authorized justification<textarea name="reason" required></textarea></label>`,form=>action('exception.authorize',{...dataOf(form),project_id:p.id}),'Record authority');break;
    case 'close-project': modal('Close project',`<p class="section-note">Closure checks outstanding commitments, liabilities, advances, residual cash and reconciliation. Closure blocks further financial activity.</p>`,()=>action('project.close',{id:Number(id)}),'Close project');break;
    case 'policy': {
      const policy=state.config.policies.find(p=>p.kind===id);
      modal(`Configure ${id} approvals`,`<p class="section-note">Use decimal thresholds with inclusive minimum/maximum. Ranges must cover all amounts without gaps. Each level lists eligible project roles; each level needs a different approver.</p><label>Threshold rules (JSON)<textarea name="rules" class="code-input" required>${esc(JSON.stringify(policy?.rules||[{min:'0.00',max:null,levels:[['manager','finance']]}],null,2))}</textarea></label>`,form=>action('policy.set',{kind:id,rules:JSON.parse(dataOf(form).rules)}));break;
    }
    case 'membership': modal('Assign project access',`<div class="field-grid">${select('project_id','Project',state.config.project_directory.map(p=>[p.id,`${p.code} · ${p.name}`]))}${select('user_id','User',state.config.users.map(u=>[u.id,`${u.name} (${u.email})`]))}${select('role','Project role',['viewer','requester','manager','finance'].map(r=>[r,r]))}</div>`,form=>{const v=dataOf(form);return action('membership.set',{...v,project_id:Number(v.project_id),user_id:Number(v.user_id)});});break;
    case 'user': modal('Create organization user',`${field('name','Name')}${field('email','Email','email')}${field('password','Initial password (minimum 12 characters)','password','','minlength="12" autocomplete="new-password"')}<label><input name="admin" type="checkbox">Organization administrator</label>`,form=>{const v=dataOf(form);return action('user.create',{...v,admin:v.admin==='on'});});break;
    case 'account': modal('Create cash account',`<div class="field-grid">${field('code','Unique account code')}${field('name','Account name')}${select('type','Account type',[['bank','Bank'],['cash','Cash'],['mobile','Mobile money']])}</div>`,form=>action('account.create',dataOf(form)));break;
    case 'period': modal('Configure accounting period',`<p class="section-note">Create a nonoverlapping period, or enter an existing ID to change its state. Existing start/end dates must match.</p><label>Existing period ID (blank to create)<input name="id" type="number" min="1"></label><div class="field-grid">${field('start_date','From','date',`${now().slice(0,4)}-01-01`)}${field('end_date','Through','date',`${now().slice(0,4)}-12-31`)}${select('state','State',[['open','Open'],['closed','Closed']])}</div>`,form=>{const v=dataOf(form);return action('period.set',{...v,id:v.id?Number(v.id):undefined});});break;
    case 'reconcile': modal('Reconcile a shared cash account',`<p class="section-note">Reconcile the whole account across all projects. The statement balance plus signed outstanding entries must equal the book balance. A nonzero difference cannot be accepted.</p><div class="field-grid">${select('account_id','Cash account',cashOptions())}${field('date','Statement through','date',now())}${field('statement_balance','Statement closing balance (USD)','text','')}</div><label>Outstanding journal line IDs (comma separated, optional)<input name="outstanding"></label><p class="muted">Journal line IDs are shown in the transaction ledger API. Reconciliation administration is restricted to organization administrators.</p>`,form=>{const v=dataOf(form);return action('reconcile',{account_id:Number(v.account_id),date:v.date,statement_balance:v.statement_balance,outstanding_line_ids:v.outstanding.split(',').map(s=>s.trim()).filter(Boolean).map(Number)});},'Accept reconciliation');break;
  }
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('button[type=submit]');button.disabled=true;$('#login-error').textContent='';
  try { if(new URLSearchParams(location.search).has('oidc_mfa')){await api('/oidc/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({otp:dataOf(event.target).otp})});history.replaceState(null,'','/');await load();return;}await api('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dataOf(event.target))});await load(); } catch(e) { $('#login-error').textContent=e.message; } finally { button.disabled=false; }
});
async function logout() { state.loadEpoch=(state.loadEpoch||0)+1;await api('/logout',{method:'POST'});pendingKeys.clear();state.details.clear();state.projects=[];state.mfaSetup=null;state.recovery=null;state.payslip=null;state.hr=null;showLogin(); }
function workspaceChrome(){const u=state.config.user;$('#avatar').textContent=u.name.split(' ').slice(0,2).map(p=>p[0]).join('');$('#user-name').innerHTML=`${esc(u.name)}<small>${u.admin?'Administrator':'Organization workspace'}</small>`;$('#workspace .local-tag').textContent=state.config.application_version?`v${state.config.application_version}`:'LOCAL';}
async function navigateTo(view){shell.close();state.view=view;await load();}
document.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el)return;
  if(el.dataset.workspaceTask){try{const task=el.dataset.workspaceTask;if(task==='employee'){state.hrTab='employees';await navigateTo('hrManagement');await extensions.perform('comp-employee','');}else if(task==='projects'){await navigateTo('projects');}else if(task==='new-project'){await navigateTo('projects');await perform('project','');}else if(task==='leave'){await navigateTo('people');experience.leave();}else if(task==='pay'||task==='settle'){await experience.chooser(task);}else if(['project-receipt','project-bill','project-pay','project-settle'].includes(task)){if(state.dashboardFilters?.project_id)state.project=Number(state.dashboardFilters.project_id);await navigateTo(task==='project-receipt'?'funding':task==='project-settle'?'advances':'spending');if(task==='project-receipt'&&current()?.sources.length)await perform('receipt','');else toast(task==='project-bill'?'Choose Record bill beside an approved purchase order.':task==='project-pay'?'Choose Pay bill beside a posted unpaid bill.':task==='project-settle'?'Choose Settle / return beside an outstanding advance.':'Add an approved project funding source before recording a receipt.');}else if(task==='project-advance'){if(state.dashboardFilters?.project_id)state.project=Number(state.dashboardFilters.project_id);await navigateTo('advances');await perform('advance-request','');}else{state.organizationTab=task==='approvals'?'journals':'dashboard';await navigateTo('organizationFinance');if(['bill','receipt','advance'].includes(task))await organization.perform('org-create',task);}}catch(e){toast(e.message);}return;}
  if(el.dataset.tablePage){updateTable(el.closest('.paged-table'),Number(el.dataset.tablePage));return;}
  if(el.dataset.demo) { $('#login-form input[name=email]').value=`${el.dataset.demo}@demo.erp`;$('#login-form input[name=password]').value='Demo-only-2026!';return; }
  if(el.dataset.view) {try{if(el.dataset.view==='organizationFinance')state.organizationTab='dashboard';await navigateTo(el.dataset.view);}catch(e){toast(e.message);}return;}
  if(el.dataset.openProject) { try{state.project=Number(el.dataset.openProject);$('#content').innerHTML='<div class="loading" role="status">Loading project…</div>';await loadProject(state.project);state.view='overview';render();}catch(e){toast(e.message);}return; }
  if(el.dataset.projectPage){el.disabled=true;try{state.projectFilters.page+=Number(el.dataset.projectPage);await fetchProjectPage();render();}catch(e){toast(e.message);el.disabled=false;}return;}
  if(el.hasAttribute('data-allocation-project-search')){const row=el.closest('.line-editor');el.disabled=true;try{const page=await api('/projects?'+new URLSearchParams({q:row.querySelector('[data-allocation-project-query]').value,status:'active',page_size:50})),select=row.querySelector('[name=project_id]'),chosen=select.selectedOptions[0];select.replaceChildren();if(chosen)select.add(chosen);for(const p of page.projects)if(String(p.id)!==chosen?.value)select.add(new Option(p.name,String(p.id)));toast(page.pagination.has_next?'Refine the project search to see further results.':'Project options updated.');}catch(e){toast(e.message);}finally{el.disabled=false;}return;}
  if(el.id==='logout'||el.id==='settings-logout') { await logout();return; }
  if(el.id==='close-modal'||el.id==='cancel-modal') { $('#action-form').workflowCleanup?.();$('#modal').close();return; }
  if(el.id==='add-line') { const type=$('#allocation-lines').dataset.type;$('#allocation-lines').insertAdjacentHTML('beforeend',lineHTML(type,{},$('#allocation-lines').children.length));return; }
  if(el.hasAttribute('data-remove-line')) { if($('#allocation-lines').children.length>1)el.closest('.line-editor').remove();return; }
  if(el.dataset.op) { try {if(el.dataset.op==='org-tab'){state.organizationTab=el.dataset.id;if(state.view!=='organizationFinance'||state.config?.compact)await navigateTo('organizationFinance');shell.close();} await perform(el.dataset.op,el.dataset.id); } catch(e) { toast(e.message); } }
});
document.addEventListener('input',event=>{if(event.target.matches('[data-table-filter]')){const box=event.target.closest('.paged-table');box.dataset.page=0;updateTable(box);}});
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('[data-allocation-project-query]')){event.preventDefault();event.target.closest('.line-editor').querySelector('[data-allocation-project-search]').click();}});
document.addEventListener('change',async event=>{
  const el=event.target;
  try{
    if(el.id==='project-select') { state.project=Number(el.value);$('#content').innerHTML='<div class="loading" role="status">Loading project…</div>';await loadProject(state.project);render(); }
    if(el.name==='project_id'&&el.closest('.line-editor')) { const row=el.closest('.line-editor'),d=await allocationProject(Number(el.value));if(!d)return;row.querySelector('[name=source_id]').innerHTML=sourceOptions(d).map(([id,l])=>`<option value="${id}">${esc(l)}</option>`).join('');row.querySelector('[name=activity]').innerHTML=d.project.activities.map(a=>`<option>${esc(a)}</option>`).join(''); }
    lifecycle.onChange(el);completion.onChange(el);extensions.onChange(el);
  }catch(e){toast(e.message);}
});
document.addEventListener('submit',async event=>{if(event.target.id==='project-filters'){event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{state.projectFilters={...dataOf(event.target),page:1};await fetchProjectPage();render();}catch(e){toast(e.message);button.disabled=false;}}});
document.addEventListener('submit',event=>{if(event.target.id==='report-filters'){event.preventDefault();state.reportFilters=dataOf(event.target);state.report=null;render();}});
for(const [view,label,icon]of [['organizationFinance','Organization Finance & Accounting','F'],['employeeLifecycle','Employee lifecycle','E'],['accounting','Organization accounting','A'],['hrManagement','HR management','H'],['salaryCosts','Project salary costs','P'],['inventory','Warehouse inventory','W'],['compensation','Compensation & benefits','P'],['catalog','Supplier & item directory','\u25a4'],['work','Payments & discussions','\u00a4'],['people','People & payroll','\u25c9'],['inbox','Notifications','!'],['security','Account security','\u26bf'],['connections','Integrations','\u2197'],['advances','Advances','⇢'],['reconciliation','Reconciliation','✓'],['reports','Financial reports','▥'],['closeout','Project closeout','◉']])$('#navigation').insertAdjacentHTML('beforeend',`<button data-view="${view}"><span>${icon}</span>${label}</button>`);
const syncNavigation=workspaceNavigation($('#navigation'));
const shell=applicationShell({state,navigate:navigateTo,logout});
window.addEventListener('beforeprint',()=>{state.printDetails=[...document.querySelectorAll('details')].map(el=>[el,el.open]);for(const [el]of state.printDetails)el.open=true;});
window.addEventListener('afterprint',()=>{for(const [el,open]of state.printDetails||[])el.open=open;});
$('#action-form').addEventListener('submit',async event=>{
  event.preventDefault();$('#submit-action').disabled=true;$('#form-error').textContent='';
  try { await submitHandler(event.target);$('#modal').close();if(state.publicResetCompleted){state.publicResetCompleted=false;toast('Password reset. Sign in with your new password and authenticator.');return;}await load();toast(state.view==='organizationFinance'?'Saved. Organization finance updated.':'Saved. Project balances updated.'); } catch(e) { $('#form-error').textContent=e.message; } finally { $('#submit-action').disabled=false; }
});
$('#content').innerHTML='<div class="loading">Loading project workspace…</div>';
experience.branding();
api('/auth/options').then(o=>{if(o.oidc){$('#login-form').insertAdjacentHTML('afterend','<button id="organization-signin" class="wide">Sign in with organization</button>');$('#organization-signin').addEventListener('click',async()=>{try{const r=await api('/oidc/start',{method:'POST'});location.assign(r.url);}catch(e){$('#login-error').textContent=e.message;}});}});
if(new URLSearchParams(location.search).has('oidc_mfa')){for(const name of ['email','password'])$('#login-form [name='+name+']').required=false;$('#login-error').textContent='Organization identity verified. Enter your authenticator or recovery code.';}
load().catch(e=>{if(e.status!==401)$('#login-error').textContent=e.message;});
window.addEventListener('hashchange',()=>openEmployeeRegistration().catch(e=>toast(e.message)));

window.addEventListener('afterprint',()=>document.body.classList.remove('procurement-print'));
