import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.js';
import {createApp} from '../src/server.js';
import {ERP} from '../src/service.js';
import {totp} from '../src/secure.js';
import {bootstrapAdministrator} from '../src/bootstrap.js';
import {openDatabase} from '../src/db.js';
import {dirname,join} from 'node:path';
import {readFileSync} from 'node:fs';

test('first administrator bootstrap requires empty database and protected MFA material without default credentials',()=>{const f=fixture();let db;try{
  db=openDatabase(join(dirname(f.path),'clean-bootstrap.sqlite'));const e=new ERP(db),mfaFile=join(dirname(f.path),'private-enrollment.json');
  assert.throws(()=>bootstrapAdministrator(e,{email:'owner@example.test',password:'Valid-initial-password!',production:true}),/MFA_SEED_FILE/);
  assert.throws(()=>bootstrapAdministrator(e,{email:'owner@example.test',password:'Demo-only-2026!',production:true,mfaFile}),/Demonstration/);
  const created=bootstrapAdministrator(e,{email:'owner@example.test',password:'Valid-initial-password!',production:true,mfaFile}),material=JSON.parse(readFileSync(mfaFile,'utf8'));assert.equal(created.mfa_enrollment_created,true);assert.equal(material.recovery_codes.length,10);assert.ok(!JSON.stringify(e.all('SELECT * FROM audit')).includes(material.secret));
  e.execute(created.id,'control.set',{name:'privileged_mfa_required',value:true},randomUUID());assert.throws(()=>e.login('owner@example.test','Valid-initial-password!'),/Authenticator/);const result=e.login('owner@example.test','Valid-initial-password!',material.recovery_codes[0]);assert.equal(e.authenticate(result.token),created.id);
  assert.throws(()=>bootstrapAdministrator(e,{email:'other@example.test',password:'Another-valid-password!',mfaFile}),/empty/);
}finally{db?.close();f.cleanup();}});

test('password reset is administrator-authorized, encrypted, one-use, expires, preserves MFA and revokes sessions',t=>{const f=fixture();try{
  const logged=f.erp.login('requester@demo.erp','Demo-only-2026!'),data={user_id:f.demo.users.requester,current_password:'Demo-only-2026!'};
  assert.throws(()=>f.op('requester','password.reset.issue',data),/Administrator/);
  for(const name of ['__proto__','constructor','toString'])assert.throws(()=>f.op('admin',name,{}),e=>e.status===404);
  assert.throws(()=>f.op('admin',[],{}),/Invalid operation/);
  const reset=f.op('admin','password.reset.issue',data),password='Stage6-reset-new-password!';assert.throws(()=>f.erp.authenticate(logged.token),/expired/);
  assert.ok(!JSON.stringify(f.erp.all('SELECT * FROM audit')).includes(reset.token));assert.ok(!JSON.stringify(f.erp.all('SELECT * FROM operations')).includes(reset.token));
  assert.equal(f.erp.completePasswordReset({token:reset.token,new_password:password}).ok,true);assert.throws(()=>f.erp.completePasswordReset({token:reset.token,new_password:password}),/expired|used/);assert.throws(()=>f.erp.login('requester@demo.erp','Demo-only-2026!'),/Invalid/);assert.ok(f.erp.login('requester@demo.erp',password));
  const second=f.op('admin','password.reset.issue',data);t.mock.timers.enable({apis:['Date'],now:Date.now()+901000});assert.throws(()=>f.erp.completePasswordReset({token:second.token,new_password:password}),/expired/);
}finally{t.mock.timers.reset();f.cleanup();}});

test('privileged MFA rejects old weak sessions, accepts single-use recovery and enforces access changes immediately',()=>{const f=fixture();try{
  const weak=f.erp.login('admin@demo.erp','Demo-only-2026!'),m=f.op('admin','mfa.enroll',{password:'Demo-only-2026!'}),codes=f.op('admin','mfa.confirm',{code:totp(m.secret,Math.floor(Date.now()/30000))}).recovery_codes;
  f.op('admin','control.set',{name:'privileged_mfa_required',value:true});assert.throws(()=>f.erp.authenticate(weak.token),/expired|Strong/);assert.throws(()=>f.erp.login('admin@demo.erp','Demo-only-2026!'),/Authenticator/);const strong=f.erp.login('admin@demo.erp','Demo-only-2026!',codes[0]);assert.equal(f.erp.authenticate(strong.token),f.demo.users.admin);assert.throws(()=>f.erp.login('admin@demo.erp','Demo-only-2026!',codes[0]),/Authenticator/);
  const employee=f.erp.login('requester@demo.erp','Demo-only-2026!');f.op('admin','membership.set',{project_id:f.demo.project,user_id:f.demo.users.requester,role:'viewer'});assert.throws(()=>f.erp.authenticate(employee.token),/expired/);
  f.op('admin','user.access',{user_id:f.demo.users.requester,enabled:false,reason:'Access terminated after independently recorded review'});assert.throws(()=>f.erp.login('requester@demo.erp','Demo-only-2026!'),/disabled/);
  assert.throws(()=>f.op('requester','request.submit',{title:'Disabled actor cannot submit',date:'2026-03-01',lines:[]}),/disabled/);
  assert.throws(()=>f.erp.run('DELETE FROM user_access_events'),/Immutable/);
  f.op('admin','hr.role',{user_id:f.demo.users.outsider,role:'supervisor',enabled:true});const audit=JSON.parse(f.erp.get("SELECT details FROM audit WHERE action='hr.role' ORDER BY id DESC LIMIT 1").details);assert.deepEqual(audit,{user_id:f.demo.users.outsider,role:'supervisor',enabled:true});
}finally{f.cleanup();}});

test('failed HTTP login throttles persist across server instances and malformed/forged requests cannot post',async()=>{const f=fixture();let server=createApp(f.db);const start=async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));return`http://127.0.0.1:${server.address().port}`;};let root=await start();try{
  const login=()=>fetch(root+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'outsider@demo.erp',password:'wrong-password'})});for(let i=0;i<10;i++)assert.equal((await login()).status,401);
  server.closeAllConnections();await new Promise(r=>server.close(r));server=createApp(f.db);root=await start();assert.equal((await login()).status,429);
  assert.equal((await fetch(root+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'null'},body:'{}'})).status,403);
  const admin=await fetch(root+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@demo.erp',password:'Demo-only-2026!'})}),cookie=admin.headers.get('set-cookie').split(';')[0];
  const csv=await fetch(root+`/api/projects/${f.demo.project}/report.csv`,{headers:{Cookie:cookie}});assert.equal(csv.status,200);await csv.text();assert.ok(f.erp.get("SELECT 1 FROM audit WHERE action='security.export'"));
  assert.equal((await fetch(root+'/api/actions',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test','Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({action:'funding.receive',data:{}})})).status,403);
  assert.equal(new ERP(f.db).get('PRAGMA integrity_check').integrity_check,'ok');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));f.cleanup();}});
