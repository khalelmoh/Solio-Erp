import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.js';
import {createApp} from '../src/server.js';
import {readFileSync} from 'node:fs';

test('employee registration requires explicit HR permission even for payroll users and administrators',async()=>{
  const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`,before=f.erp.metrics(f.demo.project),employee={code:'HR-PERMISSION',name:'Permission test employee',department:'Programs',start_date:'2026-01-01',pay_basis:'open'};
  async function register(role){const {token}=f.erp.login(`${role}@demo.erp`,'Demo-only-2026!'),response=await fetch(root+'/api/actions',{method:'POST',headers:{Cookie:`erp_session=${token}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({action:'employee.create',data:employee})});return{status:response.status,body:await response.json()};}
  try{
    for(const role of ['manager','finance','requester']){const r=await register(role);assert.equal(r.status,403);assert.match(r.body.error,/HR staff permission.*administrator/);}
    assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM employees').n,0);
    f.op('admin','org.role',{user_id:f.demo.users.admin,role:'hr',enabled:false});assert.equal((await register('admin')).status,403);
    f.op('admin','hr.role',{user_id:f.demo.users.finance,role:'hr_staff',enabled:true});const allowed=await register('finance');assert.equal(allowed.status,200);assert.equal(f.erp.employee(f.demo.users.finance,allowed.body.id).code,employee.code);assert.equal(f.erp.get("SELECT COUNT(*) AS n FROM audit WHERE action='hr.role'").n,1);assert.deepEqual(f.erp.metrics(f.demo.project),before);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));f.cleanup();}
});

test('page, entry script and imported UI modules load the same current build without caching old controls',async()=>{
  const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`,version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
  try{
    const page=await fetch(root+'/?v='+version),html=await page.text();assert.equal(page.headers.get('cache-control'),'no-store');assert.ok(html.includes(`src="/app.js?v=${version}"`));
    const entry=await fetch(root+'/app.js?v='+version),script=await entry.text();assert.equal(entry.headers.get('cache-control'),'no-store');for(const file of ['hr-ui.js','completion-ui.js','extensions-ui.js','lifecycle-ui.js'])assert.ok(script.includes(`./${file}?v=${version}`));
    const hr=await fetch(root+'/hr-ui.js?v='+version);assert.equal(hr.status,200);assert.equal(hr.headers.get('cache-control'),'no-store');assert.match(await hr.text(),/button\('Add employee'/);
    const {token}=f.erp.login('admin@demo.erp','Demo-only-2026!'),config=await(await fetch(root+'/api/config',{headers:{Cookie:`erp_session=${token}`}})).json();assert.equal(config.application_version,version);assert.ok(config.security.hr_capabilities.includes('hr_staff'));
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));f.cleanup();}
});
