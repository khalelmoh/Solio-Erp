import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase} from '../src/db.js';
import {seedStage3} from '../src/stage3-demo.js';
const path=resolve(process.argv[2]||'data/stage3-demo.sqlite');
if(existsSync(path))throw new Error('Stage 3 demo requires a new database path; existing data was preserved');
const db=openDatabase(path);
try{const result=seedStage3(db);console.log(JSON.stringify({database:path,employee:result.stage3.employee,run:result.stage3.run,gross:result.payslip.gross,recovery:result.payslip.evidence.advance_recovery,net:result.payslip.net,currency:'USD',policy:'DEMO ONLY - no statutory rates or external payment'},null,2));}finally{db.close();}
