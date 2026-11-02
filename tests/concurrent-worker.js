import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase } from '../src/db.js';
import { ERP } from '../src/service.js';
const db=openDatabase(workerData.path),erp=new ERP(db);
parentPort.postMessage({ready:true});
parentPort.once('message',()=>{
  try { const result=erp.execute(workerData.actor,workerData.action,workerData.data,workerData.key);parentPort.postMessage({ok:true,result}); }
  catch(e) { parentPort.postMessage({ok:false,error:e.message,status:e.status}); }
  finally { db.close(); }
});
