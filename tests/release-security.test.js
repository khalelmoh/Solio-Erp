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

test('password-only synthetic administrator keeps other accounts, production and explicit MFA policies protected',()=>{
  const keys=['NODE_ENV','ERP_STAGING_SYNTHETIC_ONLY','ERP_TRANSPORTS_ENABLED','ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]])),f=fixture();
  try{
    f.db.erpMasterKey=Buffer.alloc(32,9);
    const other=f.erp.createUser({name:'Other administrator',email:'other@example.test',password:'Other-administrator-password!',admin:true});
    Object.assign(process.env,{NODE_ENV:'production',ERP_STAGING_SYNTHETIC_ONLY:'true',ERP_TRANSPORTS_ENABLED:'false',ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL:'admin@demo.erp'});
    assert.equal(f.erp.requireStrongAuth(f.demo.users.admin),false);
    const session=f.erp.login('admin@demo.erp','Demo-only-2026!');assert.equal(f.erp.authenticate(session.token),f.demo.users.admin);assert.equal(f.erp.get('SELECT auth_strength FROM sessions WHERE user_id=?',f.demo.users.admin).auth_strength,1);f.erp.logout(session.token);
    assert.equal(f.erp.requireStrongAuth(other),true);assert.throws(()=>f.erp.login('other@example.test','Other-administrator-password!'),/authenticator enrollment/);
    assert.equal(f.erp.requireStrongAuth(f.demo.users.manager),true);
    process.env.ERP_STAGING_SYNTHETIC_ONLY='false';assert.equal(f.erp.requireStrongAuth(f.demo.users.admin),true);
    process.env.ERP_STAGING_SYNTHETIC_ONLY='true';process.env.ERP_TRANSPORTS_ENABLED='true';assert.equal(f.erp.requireStrongAuth(f.demo.users.admin),true);
    process.env.ERP_TRANSPORTS_ENABLED='false';
    f.erp.run("UPDATE controls SET value='true' WHERE name='privileged_mfa_required'");assert.equal(f.erp.requireStrongAuth(f.demo.users.admin),true);assert.throws(()=>f.erp.login('admin@demo.erp','Demo-only-2026!'),/authenticator enrollment/);
    f.erp.run("UPDATE controls SET value='false' WHERE name='privileged_mfa_required'");
    f.erp.run("UPDATE controls SET value='true' WHERE name='mfa_required'");assert.throws(()=>f.erp.login('admin@demo.erp','Demo-only-2026!'),/authenticator enrollment/);
    f.erp.run("UPDATE controls SET value='false' WHERE name='mfa_required'");
    const earlierWeak=f.erp.login('admin@demo.erp','Demo-only-2026!');
    const setup=f.op('admin','mfa.enroll',{password:'Demo-only-2026!'}),recovery=f.op('admin','mfa.confirm',{code:totp(setup.secret,Math.floor(Date.now()/30000))}).recovery_codes;assert.throws(()=>f.erp.login('admin@demo.erp','Demo-only-2026!'),/Authenticator/);assert.equal(f.erp.requireStrongAuth(f.demo.users.admin),true);assert.throws(()=>f.erp.authenticate(earlierWeak.token),/Strong authentication/);
    const strong=f.erp.login('admin@demo.erp','Demo-only-2026!',recovery[0]);
    const removal={current_password:'Demo-only-2026!',reason:'User requested password-only access for isolated synthetic staging'};
    assert.throws(()=>f.op('requester','mfa.staging.disable',removal),/configured synthetic staging administrator/);
    assert.throws(()=>f.op('admin','mfa.staging.disable',{...removal,current_password:'wrong-password'}),/Current password/);
    f.erp.run("UPDATE controls SET value='true' WHERE name='mfa_required'");assert.throws(()=>f.op('admin','mfa.staging.disable',removal),/Organization MFA policy/);f.erp.run("UPDATE controls SET value='false' WHERE name='mfa_required'");
    process.env.ERP_STAGING_SYNTHETIC_ONLY='false';assert.throws(()=>f.op('admin','mfa.staging.disable',removal),/configured synthetic staging administrator/);process.env.ERP_STAGING_SYNTHETIC_ONLY='true';
    f.op('admin','mfa.staging.disable',removal);assert.throws(()=>f.erp.authenticate(strong.token),/expired/);assert.equal(f.erp.securityState(f.demo.users.admin).mfa_enrolled,false);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM mfa_recovery WHERE user_id=? AND consumed=0',f.demo.users.admin).n,0);
    assert.ok(!f.erp.get("SELECT details FROM audit WHERE action='mfa.staging.disable'").details.includes('Demo-only-2026!'));
    const passwordOnly=f.erp.login('admin@demo.erp','Demo-only-2026!');assert.equal(f.erp.authenticate(passwordOnly.token),f.demo.users.admin);f.erp.logout(passwordOnly.token);
  }finally{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}f.cleanup();}
});

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
