import {installRetentionGuards} from './retention-schema.js';
import {requireImplementedDatabase} from './database-provider.js';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const defaultPath = resolve(root, 'data/erp.sqlite');
export function openDatabase(path = defaultPath) {
  if(process.env.NODE_ENV==='production'&&!process.env.ERP_DATABASE_PROVIDER)throw Error('Production requires an explicit ERP_DATABASE_PROVIDER; refusing an implicit SQLite database');
  if((process.env.ERP_DATABASE_PROVIDER||'sqlite')!=='sqlite')throw Error('PostgreSQL is not implemented in the SQLite opener; use the asynchronous PostgreSQL runtime. No SQLite fallback.');
  requireImplementedDatabase();
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.erpPath=path===':memory:'?null:resolve(path);
  db.exec('PRAGMA secure_delete=ON; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  for (const name of readdirSync(resolve(root, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) continue;
    // SQLite's supported table rebuild: suspend FKs outside the transaction,
    // preserve referring triggers, retain every ledger-line ID, then verify FKs.
    const rebuild=name==='013_organization_finance.sql';
    const triggers=rebuild?db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND sql LIKE '%journal_lines%'").all():[];
    if(rebuild)db.exec('PRAGMA foreign_keys=OFF');
    db.exec('BEGIN IMMEDIATE');
    try {
      for(const trigger of triggers)db.exec('DROP TRIGGER "'+trigger.name.replaceAll('"','""')+'"');
      db.exec(readFileSync(resolve(root, 'migrations', name), 'utf8'));
      for(const trigger of triggers)if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?").get(trigger.name))db.exec(trigger.sql);
      if(rebuild&&db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Ledger migration foreign-key validation failed');
      db.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); db.close(); throw e; }
    if(rebuild)db.exec('PRAGMA foreign_keys=ON');
  }
  // Append-only business evidence, including headers, cannot be edited/deleted.
  for (const table of ['commitments','budget_charges','approvals','audit','bills','bill_lines','payments','promises','advances','advance_lines','settlements','purchase_orders','exceptions','reconciliations','budget_changes','advance_requests','advance_terms','documents','credit_notes','credit_lines','supplier_refunds','refund_lines','promise_adjustments','correction_authorizations','correction_uses','statements','statement_lines','statement_matches','match_reversals','statement_events','statement_reviews','cash_offsets','cash_offset_lines','project_events','closure_authorizations','closure_uses']) {
    for (const action of ['UPDATE','DELETE']) db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${table}_${action} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable financial evidence'); END;`);
  }
  for(const table of ['delegations','delegation_revocations','comments','comment_events','notifications','notification_reads','request_modes','expenses','expense_lines','vouchers','work_approvals','voucher_posts','voucher_cancellations','voucher_allocations','expense_payments','expense_payment_lines','journal_proposals','journal_proposal_posts','bill_reissues','grant_versions','grant_activations','fx_rates','foreign_documents','foreign_cash_lines','employees','employee_events','attendance','leave_requests','leave_decisions','payroll_rules','payroll_rule_approvals','payroll_runs','payroll_allocations','payroll_reservations','payroll_posts','payroll_payments','payroll_payment_lines','integration_events','oidc_identities','suppliers','supplier_events','items','po_suppliers'])for(const operation of ['UPDATE','DELETE'])db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${table}_${operation} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable application evidence'); END;`);
  for(const table of ['employee_terms','employee_term_approvals','leave_pay_classifications','warehouses','stock_documents','stock_document_lines','stock_posts','stock_cancellations','stock_movements'])for(const operation of ['UPDATE','DELETE'])db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${table}_${operation} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable payroll/inventory evidence'); END;`);
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hr_%' AND name<>'hr_roles'").all())for(const operation of ['UPDATE','DELETE'])db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${name}_${operation} BEFORE ${operation} ON ${name} BEGIN SELECT RAISE(ABORT,'Immutable HR evidence'); END;`);
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'acc_*' AND name<>'acc_roles'").all())for(const operation of ['UPDATE','DELETE'])db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${name}_${operation} BEFORE ${operation} ON ${name} BEGIN SELECT RAISE(ABORT,'Immutable accounting evidence'); END;`);
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'el_*' AND name<>'el_roles'").all())for(const operation of ['UPDATE','DELETE'])db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${name}_${operation} BEFORE ${operation} ON ${name} BEGIN SELECT RAISE(ABORT,'Immutable employee lifecycle evidence'); END;`);
  installRetentionGuards(db);
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'org_*' AND name<>'org_roles'").all())for(const operation of ['UPDATE','DELETE'])db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${name}_${operation} BEFORE ${operation} ON ${name} BEGIN SELECT RAISE(ABORT,'Immutable organization finance evidence'); END;`);
  return db;
}
