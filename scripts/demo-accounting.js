import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
import {seedAccountingDemo} from '../src/accounting-demo.js';
const path=resolve(process.argv[2]||'data/accounting-demo.sqlite');
if(existsSync(path)||existsSync(path+'.key'))throw new Error('Accounting demo requires an unused database and key path; existing data was preserved');
const db=openDatabase(path);
try{const demo=seedAccountingDemo(db),erp=new ERP(db),filters={from:'2026-01-01',to:'2026-12-31'},report=erp.accountingReport(demo.users.finance,'project_statement',filters),reconciliation=erp.controlReconciliation(demo.users.finance,filters.to);console.log(JSON.stringify({database:path,currency:'USD',demonstration:true,statutory_policy:'DEMONSTRATION ONLY; all statutory amounts explicitly zero',totals:report.totals,budget:report.budget.totals,reconciled:reconciliation.ok},null,2));}finally{db.close();}
