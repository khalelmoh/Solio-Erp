import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase} from '../src/db.js';
import {seedPeople} from '../src/people-demo.js';
const path=resolve(process.argv[2]||'data/people-demo.sqlite');
if(existsSync(path)||existsSync(path+'.key'))throw new Error('Employee lifecycle demo requires an unused database and key path; existing records were preserved');
const db=openDatabase(path);
try{const r=seedPeople(db);console.log(JSON.stringify({database:path,currency:'USD',demonstration:true,employee_id:r.lifecycle.employee,staffing_id:r.lifecycle.staffing,offer_id:r.lifecycle.offer,note:'Accepted candidate, onboarding checklist, demo payroll rule and approved allocation; no lifecycle payroll or course costs posted. Demo-only permissions assigned only in this separate sample.'},null,2));}finally{db.close();}
