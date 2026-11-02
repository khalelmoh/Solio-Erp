import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
const [path,actor,key]=process.argv.slice(2),db=openDatabase(path),erp=new ERP(db);
// Crash after journal creation but before operation receipt and COMMIT.
const original=erp.afterOperation;erp.afterOperation=function(...args){original.apply(this,args);process.exit(73);};
erp.execute(Number(actor),'funding.receive',{source_id:1,account_id:1,amount:'25.00',date:'2026-03-01',reference:'CRASH-RECEIPT'},key);
