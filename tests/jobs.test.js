import test from 'node:test';
import assert from 'node:assert/strict';
import {dirname,join} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import {fixture} from './helpers.js';
import {backgroundJobs} from '../src/jobs.js';
import {runtimeConfig,setupEnvironment} from '../src/runtime.js';
import {createApp} from '../src/server.js';

test('background scans deduplicate notices, preserve finances and never deliver externally without opt-in',async()=>{const f=fixture();let delivered=0;const runner=backgroundJobs(f.erp,{enabled:true,actor:f.demo.users.admin,transportsEnabled:false,send:async()=>{delivered++;return[];}});try{
  const before=f.erp.metrics(f.demo.project);await runner.start();const count=f.erp.get('SELECT COUNT(*) AS n FROM notifications').n;assert.ok(count>0);await runner.runNow();assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM notifications').n,count);assert.equal(delivered,0);assert.deepEqual(f.erp.metrics(f.demo.project),before);assert.ok(runner.status.last_scan_at);assert.equal(runner.status.last_error,null);
}finally{await runner.stop();f.cleanup();}});

test('overlapping background ticks share one job and transport runs outside financial transactions',async()=>{const f=fixture();let release,calls=0;const gate=new Promise(r=>release=r),runner=backgroundJobs(f.erp,{enabled:true,actor:f.demo.users.admin,transportsEnabled:true,send:async()=>{assert.equal(f.db.isTransaction,false);calls++;await gate;return[{ok:true}];}});try{
  const a=runner.runNow(),b=runner.runNow();assert.equal(a,b);assert.equal(calls,1);release();assert.ok((await a).ok);assert.equal(f.erp.get("SELECT COUNT(*) AS n FROM audit WHERE action='notifications.scan'").n,1);
  const unauthorized=backgroundJobs(f.erp,{enabled:true,actor:f.demo.users.requester,transportsEnabled:true,send:async()=>{throw new Error('Must not send');}});assert.equal((await unauthorized.runNow()).ok,false);assert.match(unauthorized.status.last_error,/worker account/);
}finally{release();await runner.stop();f.cleanup();}});

test('environment bootstrap preserves an existing file and enables only known demo inbox work',()=>{const f=fixture();try{
  const dir=dirname(f.path),result=setupEnvironment({directory:dir,database:f.path,template:new URL('../.env.example',import.meta.url)});assert.equal(result.created,true);assert.equal(result.demo_jobs_enabled,true);const path=join(dir,'.env'),content=readFileSync(path,'utf8');assert.match(content,/ERP_TRANSPORTS_ENABLED=false/);assert.match(content,/ERP_JOBS_ENABLED=true/);writeFileSync(path,'PORT=3456\n# Existing settings must survive\n');assert.equal(setupEnvironment({directory:dir,database:f.path,template:new URL('../.env.example',import.meta.url)}).created,false);assert.equal(readFileSync(path,'utf8'),'PORT=3456\n# Existing settings must survive\n');
  assert.throws(()=>runtimeConfig({PORT:'not-a-port'}),/PORT/);assert.throws(()=>runtimeConfig({ERP_TIMEZONE:'Not/AZone'}),/timezone/);assert.throws(()=>runtimeConfig({ERP_JOBS_ENABLED:'true'}),/WORKER_USER/);assert.throws(()=>runtimeConfig({NODE_ENV:'production',ERP_PUBLIC_ORIGIN:'http://unsafe.example'}),/HTTPS/);
}finally{f.cleanup();}});

test('background operational status is restricted to administrators',async()=>{const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;try{for(const [user,expected]of [['requester',403],['admin',200]]){const login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`${user}@demo.erp`,password:'Demo-only-2026!'})}),cookie=login.headers.get('set-cookie').split(';')[0],response=await fetch(origin+'/api/jobs',{headers:{cookie}});assert.equal(response.status,expected);if(expected===200){const status=await response.json();assert.equal(status.enabled,false);assert.equal(status.transports_enabled,false);}}
}finally{await server.jobs.stop();await new Promise(r=>server.close(r));f.cleanup();}});
