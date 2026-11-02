import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

export async function stagingSnapshot({origin,projectId,documentId,headers,request=fetch}){
  const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use the reviewed staging HTTPS origin without credentials or a path');
  if(!Number.isSafeInteger(projectId)||projectId<1||!Number.isSafeInteger(documentId)||documentId<1)throw Error('Supply synthetic project and protected attachment IDs');
  const get=async(path,auth=true)=>{const response=await request(url.origin+path,{headers:auth?headers:{},redirect:'error',signal:AbortSignal.timeout(20000)});if(response.status!==200)throw Error('Staging probe failed for '+path+' with status '+response.status);return response;};
  const unauth=await request(url.origin+'/api/projects',{redirect:'error',signal:AbortSignal.timeout(20000)});if(![401,403].includes(unauth.status))throw Error('Unauthenticated project access must be denied');
  const health=await(await get('/api/health')).json(),config=await(await get('/api/config')).json();if(!config.user?.id)throw Error('Authenticated application account required');
  if(!health.synthetic_staging)throw Error('Target must enforce synthetic staging');
  const d=await(await get('/api/projects/'+projectId)).json();if(!d.project?.demo&&!/^(UAT-|STAGING-)/.test(d.project?.code||''))throw Error('Use an explicitly synthetic probe project');
  const jobs=await(await get('/api/jobs')).json();if(jobs.transports_enabled)throw Error('Outbound transports must be disabled');
  const attachment=await get('/api/documents/'+documentId),bytes=Buffer.from(await attachment.arrayBuffer());if(!bytes.length)throw Error('Attachment is empty');
  return {captured_at:new Date().toISOString(),origin:url.origin,instance_id:health.instance_id,version:health.version,database_provider:health.database_provider,project:{id:d.project.id,code:d.project.code},metrics:d.metrics,budget_ids:d.budgets.map(x=>x.id),request_ids:d.requests.map(x=>x.id),transaction_ids:d.transactions.map(x=>x.id),attachment:{id:documentId,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},jobs:{enabled:jobs.enabled,last_scan_at:jobs.last_scan_at,last_error:jobs.last_error,backup:jobs.backup},unauthenticated_access_denied:true};
}
export function verifyStagingPersistence(before,after){
  assert.equal(after.origin,before.origin);assert.notEqual(after.instance_id,before.instance_id,'Restart/redeployment must produce a different application instance');
  for(const key of ['database_provider','project','metrics','budget_ids','request_ids','transaction_ids','attachment'])assert.deepEqual(after[key],before[key],'Persistence mismatch: '+key);
  return {passed:true,verified_at:new Date().toISOString(),before_instance:before.instance_id,after_instance:after.instance_id,project:after.project,attachment:after.attachment,checks:'Same financial totals/source IDs/attachment across a changed application instance; topology, scheduled backup delivery and restore remain separate checks'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [mode,path]=process.argv.slice(2);if(!['capture','verify'].includes(mode)||!path)throw Error('Use capture <unused-evidence.json> or verify <capture.json>');
  const origin=process.env.ERP_STAGING_ORIGIN;if(!origin||new URL(origin).hostname.endsWith('.invalid'))throw Error('Actual ERP_STAGING_ORIGIN required; target is not verified');
  if(!process.env.ERP_STAGING_HEADERS_FILE)throw Error('Protected ERP_STAGING_HEADERS_FILE required; never pass credentials in command arguments');
  const snapshot=await stagingSnapshot({origin,projectId:Number(process.env.ERP_STAGING_PROJECT_ID),documentId:Number(process.env.ERP_STAGING_DOCUMENT_ID),headers:JSON.parse(readFileSync(process.env.ERP_STAGING_HEADERS_FILE,'utf8'))});
  if(mode==='capture')writeFileSync(path,JSON.stringify(snapshot,null,2),{flag:'wx',mode:0o600});
  else{const result=verifyStagingPersistence(JSON.parse(readFileSync(path,'utf8')),snapshot);writeFileSync(path+'.verified-'+Date.now()+'.json',JSON.stringify(result,null,2),{flag:'wx',mode:0o600});}
  console.log(mode==='capture'?'Captured staging evidence. Restart or redeploy under the change procedure before verify.':'Persistence checks passed; this is not production authorization.');
}
