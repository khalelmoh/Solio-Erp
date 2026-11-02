import {backupHealth} from './operating-health.js';
import {scryptSync,timingSafeEqual} from 'node:crypto';
import {unseal} from './secure.js';
export function inspectReadiness(erp){
  const checks=[],add=(name,ok,detail)=>checks.push({name,ok:!!ok,detail});
  add('database_integrity',erp.get('PRAGMA integrity_check').integrity_check==='ok','SQLite integrity check');
  add('foreign_keys',erp.all('PRAGMA foreign_key_check').length===0,'All linked records exist');
  add('usd_only',!erp.get("SELECT 1 FROM currency_definitions WHERE code<>'USD' OR scale<>2")&&!erp.get("SELECT 1 FROM account_currencies WHERE currency<>'USD'")&&!erp.get('SELECT 1 FROM fx_rates')&&!erp.get('SELECT 1 FROM foreign_documents')&&!erp.get('SELECT 1 FROM foreign_cash_lines'),'All financial records use USD at scale 2');
  add('balanced_journals',!erp.get("SELECT j.id FROM journals j JOIN journal_lines l ON l.journal_id=j.id WHERE j.state='posted' GROUP BY j.id HAVING SUM(l.amount)<>0 LIMIT 1"),'Every posted journal balances');
  add('posted_documents',!erp.get("SELECT id FROM journals WHERE state<>'posted' LIMIT 1"),'No abandoned draft journals');
  let decrypt=true;try{for(const e of erp.all('SELECT code,terms_encrypted FROM employees'))unseal(erp.db,e.terms_encrypted,`employee:${e.code}`);for(const r of erp.all('SELECT reference,results_encrypted FROM payroll_runs'))unseal(erp.db,r.results_encrypted,`payroll:${r.reference}`);for(const m of erp.all('SELECT user_id,secret_encrypted FROM user_mfa'))unseal(erp.db,m.secret_encrypted,`mfa:${m.user_id}`);for(const i of erp.all('SELECT name,secret_encrypted FROM integrations'))unseal(erp.db,i.secret_encrypted,`integration:${i.name}`);for(const attempt of erp.all('SELECT token_hash,payload_encrypted FROM oidc_attempts'))unseal(erp.db,attempt.payload_encrypted,`oidc:${attempt.token_hash}`);}catch{decrypt=false;}
  try{for(const t of erp.all('SELECT employee_id,effective_date,terms_encrypted FROM employee_terms'))unseal(erp.db,t.terms_encrypted,`employee-terms:${t.employee_id}:${t.effective_date}`);}catch{decrypt=false;}
  add('encrypted_records',decrypt,'Master key can decrypt restricted data');
  add('supported_runtime',[24].includes(Number(process.versions.node.split('.')[0])),'Use the supported container runtime; review support before upgrades');
  add('https_sessions',process.env.ERP_SECURE_COOKIES==='true'&&/^https:\/\//.test(process.env.ERP_PUBLIC_ORIGIN||''),'Secure cookies and an HTTPS public origin');
  add('external_master_key',!!(process.env.ERP_MASTER_KEY||process.env.ERP_MASTER_KEY_FILE),'Production key supplied by the secret store');
  add('voucher_enforcement',erp.control('require_vouchers'),'Legacy payment bypass disabled');
  add('mfa_enforcement',erp.control('mfa_required')&&!erp.get('SELECT u.id FROM users u LEFT JOIN user_mfa m ON m.user_id=u.id WHERE COALESCE(m.enabled,0)=0 LIMIT 1'),'All accounts have enrolled MFA');
  const hasDemo=erp.all('SELECT * FROM users').some(u=>timingSafeEqual(scryptSync('Demo-only-2026!',u.salt,64),Buffer.from(u.password_hash,'hex')));
  add('demo_credentials_removed',!hasDemo,'Rotate all demonstration passwords before deployment');
  add('demo_projects_removed',!erp.get('SELECT 1 FROM projects WHERE demo=1'),'Deploy an independently initialized production database');
  add('verified_payroll_rules',!erp.get('SELECT 1 FROM payroll_posts p JOIN payroll_runs r ON r.id=p.run_id JOIN payroll_rules x ON x.id=r.rule_id WHERE x.demo=1'),'Posted payroll uses verified organization rules');
  add('business_policy_signoff',process.env.ERP_POLICY_SIGNOFF==='true','Organization has authorized jurisdiction, rates, approvals, retention and donor rules');
  add('lifecycle_approval_setup',!!erp.get('SELECT 1 FROM ops_setup_runs'),'Explicit HR, hiring, payroll, access and privacy responsibilities configured');
  const policy=erp.all("SELECT id FROM el_documents WHERE kind='final_policy' ORDER BY id DESC").map(r=>erp.elDoc(r.id)).find(d=>erp.elState(d)==='approved'&&d.payload.policy_state==='validated');
  add('validated_final_pay_policy',!!policy,'An independent approver has approved the organization-validated final-pay agreement');
  for(const kind of ['scim','calendar'])add(kind+'_provider_verified',erp.all('SELECT * FROM ops_connections WHERE kind=? AND enabled=1',kind).some(c=>erp.providerReady(c)),'Authenticated provider verification with the current endpoint and credential; actual delivery requires a receipt');
  add('retention_authorized',!!erp.get('SELECT 1 FROM ops_retention_rules r JOIN ops_retention_approvals a ON a.rule_id=r.id WHERE r.automatic=1'),'Automatic deletion requires independently approved retention authority and explicit legal-hold review');
  add('backup_current',backupHealth().ok,'Authenticated encrypted backup job status is current; actual restore rehearsal is separate');
  add('recovery_quarantine_cleared',!erp.quarantined(),'Restored copies cannot deliver externally until operator review');
  add('hosting_restore_load_verification',process.env.ERP_DEPLOYMENT_VERIFIED==='true','Operator has verified HTTPS, provider delivery, restore and capacity on target hosting');
  return{ready:checks.every(c=>c.ok),checks};
}
