import {parentPort,workerData} from 'node:worker_threads';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
import {randomUUID} from 'node:crypto';
let db;
try{db=openDatabase(workerData.path);const result=new ERP(db).execute(workerData.actor,'acc.document.approve',{id:workerData.id},randomUUID());parentPort.postMessage({ok:true,result});}catch(error){parentPort.postMessage({ok:false,error:error.message,status:error.status});}finally{db?.close();}
