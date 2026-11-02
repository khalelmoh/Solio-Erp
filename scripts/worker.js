import {openDatabase,defaultPath} from '../src/db.js';
import {ERP} from '../src/service.js';
import {backgroundJobs} from '../src/jobs.js';
import {runtimeConfig} from '../src/runtime.js';
if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER)){await (await import('./postgres-tools.js')).postgresTool('worker');}else{
const db=openDatabase(process.env.ERP_DB||defaultPath),erp=new ERP(db);
try{const config=runtimeConfig(),actor=config.jobs.actor;erp.admin(actor);const jobs=backgroundJobs(erp,{...config.jobs,enabled:true});const result=await jobs.runNow();console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;await jobs.stop();}finally{db.close();}

}