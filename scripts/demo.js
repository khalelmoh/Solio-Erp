import { openDatabase, defaultPath } from '../src/db.js';
import { seedDemo, DEMO_PASSWORD } from '../src/demo.js';
const db=openDatabase(process.env.ERP_DB||defaultPath);
try { const data=seedDemo(db); console.log('Labelled demonstration data created.'); console.log('Users: manager@demo.erp, finance@demo.erp, requester@demo.erp, admin@demo.erp, outsider@demo.erp'); console.log('LOCAL DEMO password:',DEMO_PASSWORD); console.log('Verification balances (minor units):',data.metrics); }
finally { db.close(); }
