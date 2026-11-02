import test from 'node:test';
import assert from 'node:assert/strict';
import {dirname,join} from 'node:path';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {accountingFixture} from './accounting-helpers.js';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
import {createApp} from '../src/server.js';
import {encryptedBackup,restoreEncryptedBackup,readEncryptedBackup,pruneEncryptedBackups,archiveFilename} from '../src/recovery.js';
import {drainTransports,verifySMTP} from '../src/transport.js';
import {drainProviderJobs} from '../src/operations-integrations.js';
import {backgroundJobs} from '../src/jobs.js';

test('encrypted archive restores authentication, attachments, approvals, audit, payroll and accounting into network quarantine',async()=>{
  const f=accountingFixture(),root=dirname(f.path),keyFile=join(root,'backup-secret'),archive=join(root,archiveFilename()),destination=join(root,'restored.sqlite');writeFileSync(keyFile,randomBytes(32).toString('hex'));let restored,server;
  try{
    const file=f.op('admin','hr.document',{employee_id:f.demo.employee,filename:'recovery-contract.txt',mime:'text/plain',content:Buffer.from('Stage 6 private contract evidence').toString('base64'),visibility:'hr'}).id;
    const before={metrics:f.erp.metrics(f.demo.project),slip:f.erp.payslip(f.demo.users.admin,f.demo.run,f.demo.employee),report:f.erp.accountingReport(f.demo.users.finance,'position',{from:'2026-01-01',to:'2026-12-31'}),audit:f.erp.all('SELECT * FROM audit'),approvals:f.erp.all('SELECT * FROM work_approvals')};
    const backup=encryptedBackup(f.path,archive,{keyFile});assert.equal(backup.master_key_included,false);assert.ok(!readFileSync(archive).includes(Buffer.from('SQLite format 3')));assert.throws(()=>encryptedBackup(f.path,archive,{keyFile}),/unused/);
    const result=restoreEncryptedBackup(archive,destination,{keyFile,masterKeyFile:f.path+'.key'});assert.ok(result.quarantined);restored=openDatabase(destination);const e=new ERP(restored);assert.deepEqual(e.metrics(f.demo.project),before.metrics);assert.deepEqual(e.payslip(f.demo.users.admin,f.demo.run,f.demo.employee),before.slip);assert.deepEqual(e.accountingReport(f.demo.users.finance,'position',{from:'2026-01-01',to:'2026-12-31'}),before.report);assert.deepEqual(e.all('SELECT * FROM work_approvals'),before.approvals);assert.deepEqual(e.all('SELECT * FROM audit').slice(0,before.audit.length),before.audit);assert.equal(Buffer.from(e.hrDocument(f.demo.users.admin,file).content,'base64').toString(),'Stage 6 private contract evidence');
    let network=0;await assert.rejects(()=>drainTransports(e,{fetcher:async()=>{network++;}}),/quarantine/);await assert.rejects(()=>drainProviderJobs(e,{fetcher:async()=>{network++;}}),/quarantine/);await assert.rejects(()=>verifySMTP(e,f.demo.users.admin,{smtpTransport:{verify:async()=>{network++;}}}),/quarantine/);assert.throws(()=>e.inbound(1,'{}','0','0'),/quarantine/);const worker=backgroundJobs(e,{enabled:true,actor:f.demo.users.admin,transportsEnabled:true});assert.equal((await worker.runNow()).quarantined,true);assert.equal(network,0);
    server=createApp(restored);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'finance@demo.erp',password:'Demo-only-2026!'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(origin+'/api/accounting/reports/position.csv?from=2026-01-01&to=2026-12-31',{headers:{Cookie:cookie}})).status,200);assert.equal((await fetch(origin+'/api/hr/reports.csv',{headers:{Cookie:cookie}})).status,200);assert.equal((await fetch(origin+'/api/auth/options')).status,200);
  }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}restored?.close();f.cleanup();}
});

test('corrupt archives, wrong independent keys and overwrite attempts fail; retention touches only named authenticated archives',()=>{const f=accountingFixture();try{
  const root=dirname(f.path),keyFile=join(root,'backup-key'),wrong=join(root,'wrong-key');writeFileSync(keyFile,randomBytes(32).toString('hex'));writeFileSync(wrong,randomBytes(32).toString('hex'));const paths=[];
  for(let i=0;i<3;i++){const now=new Date(Date.UTC(2020,0,i+1)),path=join(root,archiveFilename(now));encryptedBackup(f.path,path,{keyFile,now});paths.push(path);}
  assert.throws(()=>readEncryptedBackup(paths[0],{keyFile:wrong}),/authentication/);assert.throws(()=>restoreEncryptedBackup(paths[0],join(root,'wrong-restore.sqlite'),{keyFile,masterKeyFile:wrong}),/master key/);assert.equal(existsSync(join(root,'wrong-restore.sqlite')),false);
  const damaged=join(root,'corrupted.erpbackup'),bytes=readFileSync(paths[0]);bytes[bytes.length-1]^=1;writeFileSync(damaged,bytes);assert.throws(()=>readEncryptedBackup(damaged,{keyFile}),/authentication/);
  const untouched=join(root,'preserve.sqlite');writeFileSync(untouched,'Preserve me');assert.throws(()=>restoreEncryptedBackup(paths[0],untouched,{keyFile,masterKeyFile:f.path+'.key'}),/unused/);assert.equal(readFileSync(untouched,'utf8'),'Preserve me');
  const pruned=pruneEncryptedBackups(root,{keyFile,days:1,now:new Date('2030-01-01')});assert.equal(pruned.deleted.length,1);assert.ok(existsSync(paths[1])&&existsSync(paths[2])&&existsSync(damaged)&&existsSync(untouched));
}finally{f.cleanup();}});
