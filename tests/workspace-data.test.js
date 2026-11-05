import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspaceData} from '../public/workspace-data.js';

function setup(view,overrides={}){
  const calls=[],state={view,config:{user:{id:1,admin:1},accounting_roles:['accountant'],security:{roles:['hr','payroll']}},projectFilters:{page:1,page_size:20},details:new Map(),...overrides};
  const result=path=>path.startsWith('/projects?')?{projects:[]}:path==='/my-work'?{employee:null}:path==='/hr/stage3'?{capabilities:['hr_staff']}:{};
  const api=async path=>{calls.push(path);return result(path);},module=name=>({load:async()=>calls.push('module:'+name)});
  return{state,calls,args:{state,api,now:()=> '2026-11-05',loadProject:async id=>calls.push('project:'+id),organization:module('organization'),accounting:module('accounting'),lifecycle:module('lifecycle'),isCurrent:()=>true}};
}

test('Finance navigation never fetches unrelated HR, projects, integrations or accounting statements',async()=>{
  const f=setup('organizationFinance');await loadWorkspaceData(f.args);assert.deepEqual(f.calls,['module:organization']);
});
test('security and inbox navigation load only their own data',async()=>{
  const security=setup('security');await loadWorkspaceData(security.args);assert.deepEqual(security.calls,[]);
  const inbox=setup('inbox');await loadWorkspaceData(inbox.args);assert.deepEqual(inbox.calls,['/inbox']);
});
test('HR navigation preserves employee/leave/payroll dependencies without loading other organization modules',async()=>{
  const f=setup('hrManagement');await loadWorkspaceData(f.args);
  assert.ok(f.calls.includes('/my-work'));assert.ok(f.calls.includes('/hr/stage3'));assert.ok(f.calls.includes('/hr'));assert.ok(f.calls.some(p=>p.startsWith('/hr/reports?')));assert.equal(f.calls.filter(p=>p==='/my-work').length,1);assert.ok(!f.calls.some(p=>p.startsWith('module:')||['/integrations','/jobs','/catalog','/reconciliation'].includes(p)));
});
test('pending workspace responses cannot restore private data after logout or another navigation',async()=>{
  const f=setup('hrManagement');let current=true,release;const pending=new Promise(r=>release=r);f.args.isCurrent=()=>current;f.args.api=async path=>{await pending;return path.startsWith('/projects?')?{projects:[]}:path==='/hr/stage3'?{capabilities:['hr_staff']}:{employee:{id:1}};};
  const loading=loadWorkspaceData(f.args);current=false;release();assert.equal(await loading,false);assert.equal(f.state.selfHR,undefined);assert.equal(f.state.stageHR,undefined);assert.equal(f.state.hr,undefined);assert.equal(f.state.projectPage,undefined);
});
test('independent page resources start together and a lost project membership is rechecked',async()=>{
  const f=setup('inventory',{project:9});let release;const pending=new Promise(r=>release=r);const started=[];
  f.args.api=async path=>{started.push(path);await pending;return path.startsWith('/projects?')?{projects:[{id:2}]}:{items:[]};};
  const checked=[];f.args.loadProject=async id=>{checked.push(id);if(id===9)throw Object.assign(Error('denied'),{status:403});};
  const loading=loadWorkspaceData(f.args);assert.equal(started.length,2);release();await loading;assert.deepEqual(checked,[9,2]);assert.equal(f.state.project,2);
});
