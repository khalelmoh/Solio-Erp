import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {createServer as httpServer} from 'node:http';
import {join,dirname} from 'node:path';
import {existsSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {fixture} from './helpers.js';
import {createApp} from '../src/server.js';
import {drainTransports} from '../src/transport.js';
import {backupDatabase} from '../src/backup.js';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
import {inspectReadiness} from '../src/preflight.js';

test('encrypted backup restores restricted records and preserves exact financial balances',()=>{const f=fixture();try{
  const employee=f.op('admin','employee.create',{code:'RESTORE-EMP',name:'Restore employee',department:'Programs',start_date:'2026-01-01',monthly_salary:'1000.00'}).id;
  const destination=join(dirname(f.path),'restore.sqlite'),backup=backupDatabase(f.path,destination);assert.ok(backup.local_key_included);assert.ok(existsSync(destination+'.key'));assert.throws(()=>backupDatabase(f.path,destination),/unused/);
  const db=openDatabase(destination);try{const erp=new ERP(db);assert.deepEqual(erp.metrics(f.demo.project),f.erp.metrics(f.demo.project));assert.equal(erp.employee(f.demo.users.admin,employee).terms.monthly_salary,'1000.00');const readiness=inspectReadiness(erp);assert.ok(readiness.checks.find(c=>c.name==='encrypted_records').ok);assert.ok(readiness.checks.find(c=>c.name==='database_integrity').ok);assert.equal(readiness.ready,false);}finally{db.close();}
}finally{f.cleanup();}});

test('SMTP delivery uses a local server, durable status, and contains no confidential payroll',async()=>{const f=fixture(),saved={};for(const k of ['ERP_SMTP_HOST','ERP_SMTP_PORT','ERP_SMTP_FROM','ERP_SMTP_SECURE'])saved[k]=process.env[k];let content='';const server=createServer(socket=>{socket.write('220 localhost ESMTP\r\n');let buffer='',data=false;socket.on('data',chunk=>{buffer+=chunk.toString();let n;while((n=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+2);if(data){if(line==='.'){data=false;socket.write('250 queued\r\n');}else content+=line+'\n';}else if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 8BITMIME\r\n');else if(/^MAIL FROM|^RCPT TO/.test(line))socket.write('250 OK\r\n');else if(line==='DATA'){data=true;socket.write('354 End with dot\r\n');}else if(line==='QUIT'){socket.end('221 Bye\r\n');}else socket.write('250 OK\r\n');}});});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  process.env.ERP_SMTP_HOST='127.0.0.1';process.env.ERP_SMTP_PORT=String(server.address().port);process.env.ERP_SMTP_FROM='erp@local.test';process.env.ERP_SMTP_SECURE='false';
  f.op('finance','comment.add',{project_id:f.demo.project,kind:'project',entity_id:f.demo.project,location:'Overview',body:'Confidential amount 123456 should never be copied into email'});const result=await drainTransports(f.erp);assert.ok(result.length);assert.ok(result.every(r=>r.ok));assert.ok(content.includes('Subject: New project comment'));assert.ok(!content.includes('123456'));assert.equal(f.erp.get("SELECT COUNT(*) AS n FROM deliveries WHERE state<>'sent'").n,0);
}finally{await new Promise(r=>server.close(r));for(const[k,v]of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;f.cleanup();}});

test('live local webhook verifies the transport signature and idempotency key',async()=>{const f=fixture(),saved=process.env.ERP_ALLOW_LOCAL_TRANSPORT,secret='webhook-test-secret-32-characters-abcdef';let event;const server=httpServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;event={headers:req.headers,payload:JSON.parse(raw)};assert.equal(req.headers['x-erp-signature'],createHmac('sha256',secret).update(`${req.headers['x-erp-timestamp']}.${raw}`).digest('hex'));res.end('OK');});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  process.env.ERP_ALLOW_LOCAL_TRANSPORT='true';f.op('admin','integration.configure',{name:'LOCAL WEBHOOK',endpoint:`http://127.0.0.1:${server.address().port}/events`,secret,enabled:true});const posted=f.op('finance','funding.receive',{source_id:f.demo.source,account_id:1,amount:'10.00',reference:'WEBHOOK-RECEIPT',date:'2026-03-01'});const result=await drainTransports(f.erp);assert.ok(result.every(x=>x.ok));assert.equal(event.headers['idempotency-key'],`journal:${posted.id}`);assert.equal(event.payload.event,'journal.posted');
}finally{await new Promise(r=>server.close(r));if(saved===undefined)delete process.env.ERP_ALLOW_LOCAL_TRANSPORT;else process.env.ERP_ALLOW_LOCAL_TRANSPORT=saved;f.cleanup();}});

test('HTTP screens and restricted HR/integration/payslip endpoints enforce server permissions',async()=>{const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;try{
  const logged=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'requester@demo.erp',password:'Demo-only-2026!'})});const cookie=logged.headers.get('set-cookie').split(';')[0];for(const route of ['/api/hr','/api/integrations'])assert.equal((await fetch(origin+route,{headers:{cookie}})).status,403);
  assert.equal((await fetch(origin+`/api/projects/${f.demo.project}/work`,{headers:{cookie}})).status,200);assert.equal((await fetch(origin+'/completion-ui.js')).status,200);assert.equal((await fetch(origin+'/api/inbox',{headers:{cookie}})).status,200);
}finally{await new Promise(r=>server.close(r));f.cleanup();}});
