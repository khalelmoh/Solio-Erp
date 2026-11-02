import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase,defaultPath} from '../src/db.js';
import {ERP} from '../src/service.js';

// Explicit local demonstration rollout. No human policy approval or external delivery is simulated.
const path=resolve(process.env.ERP_DB||defaultPath),proof=JSON.parse(readFileSync('artifacts/operations-migration-preview.json','utf8'));
assert.equal(path,proof.source,'Run a paired migration rehearsal for this exact database first');
const original=new DatabaseSync(path,{readOnly:true}),tables=['employees','journals','journal_lines','budget_charges','commitments','payments','payroll_runs','hr_roles'];
const snapshot=db=>Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));let old;try{old=snapshot(original);}finally{original.close();}
const db=openDatabase(path);try{
  const erp=new ERP(db),user=email=>{const u=erp.get('SELECT * FROM users WHERE email=?',email);assert.ok(u,'Expected local account '+email);return u;},admin=user('admin@demo.erp'),manager=user('manager@demo.erp'),finance=user('finance@demo.erp');assert.equal(admin.admin,1);
  const before=erp.all('SELECT id FROM projects').map(p=>({id:p.id,metrics:erp.metrics(p.id)}));assert.deepEqual(before,proof.projects,'Main changed after rehearsal; review before configuring');
  const setup=erp.execute(admin.id,'ops.setup',{hr_user:admin.id,hiring_user:manager.id,payroll_preparer:finance.id,payroll_approver:manager.id,finance_user:finance.id,moderator_user:admin.id,access_user:admin.id,privacy_user:manager.id,reason:'User-authorized local demonstration responsibilities; retain current user grants and require independent approvals'},'local-operations-0.8.0-roles');
  const policy=erp.execute(admin.id,'ops.policy.somaliland',{reference:'SOMALILAND-STANDARD-DRAFT-2026',start_date:'2026-01-01',end_date:'2029-12-31',policy_state:'provisional',partial_years:'manual_review',leave_divisor:26,gratuity_taxable:true,leave_taxable:true,agreement:'Unsigned organization worksheet: docs/somaliland-agreement-template.md. Salary basis, partial years, divisor, notice and tax require genuine signed agreement and independent validation before use.',reason:'User selected Somaliland. Cited provisional template only; no statutory validation or employer/employee signatures asserted.'},'local-operations-0.8.0-policy');
  const current=snapshot(db);for(const t of tables.filter(t=>t!=='hr_roles'))assert.deepEqual(current[t],old[t],t+' changed unexpectedly');for(const r of old.hr_roles)assert.ok(current.hr_roles.some(n=>n.user_id===r.user_id&&n.role===r.role),'Existing HR role removed');
  const projects=erp.all('SELECT id FROM projects').map(p=>({id:p.id,metrics:erp.metrics(p.id)}));assert.deepEqual(projects,before);
  const result={version:'0.8.0',schema:erp.get('SELECT COUNT(*) AS n FROM schema_migrations').n,integrity:erp.get('PRAGMA integrity_check').integrity_check,foreign_key_errors:erp.all('PRAGMA foreign_key_check').length,key_unchanged:readFileSync(path+'.key').equals(readFileSync(proof.backup+'.key')),employees:current.employees.length,financial_and_employee_tables_unchanged:tables.filter(t=>t!=='hr_roles'),existing_hr_roles_preserved:old.hr_roles.length,setup_id:setup.id,policy_id:policy.id,policy_state:'provisional, pending genuine independent validation/approval',retention_policies_activated:0,external_delivery_enabled:false,projects};
  assert.equal(result.schema,11);assert.equal(result.integrity,'ok');assert.equal(result.foreign_key_errors,0);assert.equal(result.key_unchanged,true);writeFileSync('artifacts/migration-0.8.0.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{db.close();}
