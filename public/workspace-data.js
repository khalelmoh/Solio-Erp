// Navigation reads the selected workspace. No data is cached across requests.
export function workspaceDataPlan(view){
  const hr=['hrManagement','people','compensation','employeeLifecycle'].includes(view);
  const project=['overview','budgets','funding','spending','advances','closeout','reports','transactions','salaryCosts','inventory','work','settings','connections','reconciliation','catalog','accounting'].includes(view)||hr;
  return{project:project?'detail':view==='projects'?'list':null,hr,catalog:['catalog','inventory','spending','work'].includes(view),self:hr,inbox:view==='inbox',integrations:view==='connections',jobs:['connections','settings'].includes(view),reconciliation:view==='reconciliation',organization:view==='organizationFinance',accounting:view==='accounting',lifecycle:view==='employeeLifecycle'};
}

export async function loadWorkspaceData({state,api,now,loadProject,organization,accounting,lifecycle,isCurrent}){
  const view=state.view,plan=workspaceDataPlan(view),tasks=[];
  const read=async(key,path,map=v=>v)=>{const value=await api(path);if(isCurrent())state[key]=map(value);return value;};
  if(plan.project)tasks.push((async()=>{
    const page=await api('/projects?'+new URLSearchParams(state.projectFilters));if(!isCurrent())return;
    state.projectPage=page;state.projects=page.projects;state.project=state.project||state.projects[0]?.id||null;
    if(plan.project==='detail'&&state.project){try{await loadProject(state.project,{view});}catch(error){if(error.status!==403||!isCurrent())throw error;state.details.clear();state.project=page.projects[0]?.id||null;if(state.project)await loadProject(state.project,{view});}}
  })());
  if(plan.catalog)tasks.push(read('catalog','/catalog'));
  if(plan.inbox)tasks.push(read('inbox','/inbox',v=>v.notifications));
  if(plan.integrations&&state.config.user.admin)tasks.push(read('integrations','/integrations'));
  if(plan.jobs&&state.config.user.admin)tasks.push(read('jobs','/jobs'));
  if(plan.reconciliation&&(state.config.user.admin||state.config.accounting_roles.includes('accountant')))tasks.push(read('reconciliation','/reconciliation'));
  if(plan.hr){
    const self=read('selfHR','/my-work'),stage=read('stageHR','/hr/stage3');tasks.push(self,stage);
    if(state.config.security.roles.some(r=>['hr','payroll'].includes(r)))tasks.push(read('hr','/hr'));else state.hr=null;
    if(view==='hrManagement')tasks.push(Promise.all([self,stage]).then(([s,h])=>isCurrent()&&(h.capabilities.length||s.employee)?read('hrReports','/hr/reports?'+new URLSearchParams(state.hrFilters||{from:now().slice(0,7)+'-01',to:now()})):null));
  }
  if(plan.organization)tasks.push(organization.load());
  if(plan.accounting)tasks.push(accounting.load());
  if(plan.lifecycle)tasks.push(lifecycle.load());
  await Promise.all(tasks);return isCurrent();
}
