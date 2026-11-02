import {randomUUID} from 'node:crypto';
import {drainProviderJobs} from './operations-integrations.js';
import {drainTransports} from './transport.js';

export function backgroundJobs(erp,{enabled=false,actor=null,interval=300000,transportsEnabled=false,send=drainTransports}={}){
  let timer=null,inFlight=null;
  const status={enabled,worker_user:actor,interval_seconds:interval/1000,transports_enabled:transportsEnabled,running:false,last_scan_at:null,last_error:null};
  const runNow=()=>{
    if(!enabled||erp.quarantined())return Promise.resolve({skipped:true,quarantined:erp.quarantined()});if(inFlight)return inFlight;
    status.running=true;status.last_error=null;
    inFlight=(async()=>{try{erp.admin(actor);erp.execute(actor,'notifications.scan',{},randomUUID());status.last_scan_at=new Date().toISOString();const deliveries=transportsEnabled?[...await send(erp),...await drainProviderJobs(erp)]:[];if(deliveries.some(d=>!d.ok))status.last_error='Some deliveries require retry; review the delivery queue';return{ok:true,deliveries};}catch{status.last_error='Background work failed; verify the worker account and delivery configuration';return{ok:false,error:status.last_error};}})().finally(()=>{inFlight=null;status.running=false;});
    return inFlight;
  };
  return{status,runNow,start(){if(enabled&&!timer){timer=setInterval(runNow,interval);timer.unref();return runNow();}return Promise.resolve({skipped:true});},async stop(){if(timer)clearInterval(timer);timer=null;await inFlight;}};
}
