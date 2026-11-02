import {openDatabase,defaultPath} from '../src/db.js';
import {ERP} from '../src/service.js';
import {inspectReadiness} from '../src/preflight.js';
if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER)){await (await import('./postgres-tools.js')).postgresTool('preflight');}else{
const db=openDatabase(process.env.ERP_DB||defaultPath);try{const result=inspectReadiness(new ERP(db));console.log(JSON.stringify(result,null,2));if(!result.ready)process.exitCode=1;}finally{db.close();}

}