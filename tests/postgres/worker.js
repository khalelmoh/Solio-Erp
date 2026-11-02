import {parentPort,workerData} from 'node:worker_threads';
import {postgresTestConfig} from '../postgres-fixture.js';
import {openPostgres} from '../../src/postgres-db.js';
import {ERP} from '../../.cache/postgres-runtime/src/service.js';
const config=postgresTestConfig();if(!/^test_[a-f0-9]{32}$/.test(workerData.path))throw Error('Only isolated PostgreSQL fixture schemas are allowed');
const db=await openPostgres(null,{env:{ERP_POSTGRES_URL:config.application,ERP_MASTER_KEY_FILE:config.key_file,ERP_POSTGRES_SCHEMA:workerData.path}}),erp=new ERP(db);
parentPort.postMessage({ready:true});parentPort.once('message',async()=>{try{parentPort.postMessage({ok:true,result:await erp.execute(workerData.actor,workerData.action,workerData.data,workerData.key)});}catch(e){parentPort.postMessage({ok:false,error:e.message,status:e.status});}finally{await db.close();}});
