import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readdirSync,readFileSync,realpathSync,statSync,writeFileSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';

export const roles=['finance','hr','project_manager','employee','administrator_security'];
export const declaration='I personally reviewed the recorded scenarios and evidence. These are my own findings within my stated authority. This decision covers isolated synthetic UAT only, not legal validation, live payroll, deployment or another reviewer\'s approval.';
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=file=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function requireRole(role){if(!roles.includes(role))throw Error('Choose finance, hr, project_manager or employee');}
function filled(value,label){if(typeof value!=='string'||value.trim().length<3||/^(pending|tbd|your name|reviewer name|example)$/i.test(value.trim()))throw Error('Provide '+label);return value.trim();}
function worksheetFingerprint(worksheet){return hash(JSON.stringify({role:worksheet.role,commands:worksheet.commands,steps:worksheet.steps.map(({id,action,expected})=>({id,action,expected}))}));}
export function reviewContext(root=process.cwd()){
  const files={};
  function add(path){const target=resolve(root,path);if(!existsSync(target))return;const stat=statSync(target);if(stat.isDirectory()){for(const name of readdirSync(target).sort())add(path+'/'+name);}else files[path]=hash(readFileSync(target));}
  for(const path of ['package.json','package-lock.json','src','public','migrations','scripts','docs/policy-approval-packet.md'])add(path);
  return {version:read(resolve(root,'package.json')).version,fingerprint:hash(JSON.stringify(files)),files};
}
export function prepareWorksheet(role,plan,root=process.cwd()){
  requireRole(role);mkdirSync(resolve(root,'artifacts/uat'),{recursive:true});const path=resolve(root,'artifacts/uat',role+'.json');
  if(existsSync(path))return read(path); // Never replace entered findings or prior decisions.
  const record={role,prepared_at:new Date().toISOString(),environment:'Isolated synthetic acceptance scripts; never use a production database',context:reviewContext(root),automation:'not run by this worksheet',human_acceptance:'pending',reviewer:null,reviewed_at:null,evidence:[],steps:plan.steps.map(([action,expected],i)=>({id:role.toUpperCase()+'-'+(i+1),action,expected,actual:null,result:'pending',evidence:[]})),commands:plan.scripts.map(s=>'node scripts/'+s)};
  writeFileSync(path,JSON.stringify(record,null,2),{flag:'wx'});return record;
}
export function reviewTemplate(role,root=process.cwd()){
  requireRole(role);const worksheet=read(resolve(root,'artifacts/uat',role+'.json'));
  return {role,scope:'synthetic_uat',context_fingerprint:reviewContext(root).fingerprint,worksheet_fingerprint:worksheetFingerprint(worksheet),reviewer:{name:'',organization_role:'',authority:''},reviewed_at:'',decision:'pending',declaration:'',unresolved_defects:[],steps:worksheet.steps.map(s=>({id:s.id,action:s.action,expected:s.expected,actual:'',result:'pending',evidence:[]})),required_declaration:declaration};
}
function evidenceFile(reference,root){
  if(typeof reference!=='string'||! /^(artifacts|docs)\//.test(reference)||! /\.(json|txt|md|csv|png|jpg|jpeg|pdf)$/i.test(reference))throw Error('Evidence must reference a review document or image in artifacts/ or docs/');
  const base=realpathSync(root),file=realpathSync(resolve(root,reference)),rel=relative(base,file);
  if(rel.startsWith('..'+sep)||rel==='..'||resolve(base,rel)!==file||! /^(artifacts|docs)[\\/]/.test(rel)||!statSync(file).isFile())throw Error('Evidence must remain inside artifacts/ or docs/');
  return {path:reference,sha256:hash(readFileSync(file))};
}
export function recordReview(input,root=process.cwd()){
  requireRole(input.role);if(input.scope!=='synthetic_uat')throw Error('Only isolated synthetic UAT declarations are supported here');
  const context=reviewContext(root);if(input.context_fingerprint!==context.fingerprint)throw Error('Build or policy packet changed; inspect the current evidence and create a fresh template');
  const worksheet=read(resolve(root,'artifacts/uat',input.role+'.json'));
  if(input.worksheet_fingerprint!==worksheetFingerprint(worksheet))throw Error('Worksheet scenarios changed; inspect them and create a fresh template');
  const reviewer=Object.fromEntries(['name','organization_role','authority'].map(k=>[k,filled(input.reviewer?.[k],'reviewer '+k)]));
  if(input.declaration!==declaration)throw Error('The actual reviewer must make the required declaration');
  if(!['accepted','requires_changes','rejected'].includes(input.decision))throw Error('Record accepted, requires_changes or rejected');
  if(typeof input.reviewed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(input.reviewed_at)||!Number.isFinite(Date.parse(input.reviewed_at))||Date.parse(input.reviewed_at)>Date.now()+300000)throw Error('Provide the actual review timestamp in ISO format, not a future date');
  if(!Array.isArray(input.unresolved_defects)||input.unresolved_defects.some(d=>typeof d!=='string'||!d.trim()))throw Error('List unresolved defects explicitly');
  if(!Array.isArray(input.steps)||input.steps.length!==worksheet.steps.length)throw Error('Include every worksheet scenario exactly once');
  const evidence=[];
  for(const step of worksheet.steps){
    const found=input.steps.filter(s=>s.id===step.id);if(found.length!==1)throw Error('Missing or duplicated scenario '+step.id);const result=found[0];
    if(!['passed','failed','not_run'].includes(result.result))throw Error('Record the actual result for '+step.id);
    if(input.decision==='accepted'&&result.result!=='passed')throw Error('Acceptance requires every scenario to pass');
    if(!Array.isArray(result.evidence))throw Error('List evidence for '+step.id);
    if(result.result!=='not_run'){filled(result.actual,'observed result for '+step.id);if(!result.evidence.length)throw Error('Attach reviewed evidence for '+step.id);}
    for(const ref of result.evidence)evidence.push(evidenceFile(ref,root));
  }
  if(input.decision==='accepted'&&input.unresolved_defects.length)throw Error('Resolve defects before acceptance');
  // A declaration records a human's report; it cannot prove identity or confer authority.
  const dir=resolve(root,'artifacts/uat/reviews');mkdirSync(dir,{recursive:true});
  const latest=Math.max(0,...readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>Date.parse(read(resolve(dir,n)).recorded_at)));
  const record={...input,reviewer,context,recorded_at:new Date(Math.max(Date.now(),latest+1)).toISOString(),id:randomUUID(),evidence_files:evidence};delete record.required_declaration;
  const file=resolve(dir,record.id+'.json');
  writeFileSync(file,JSON.stringify(record,null,2),{flag:'wx',mode:0o600});return {path:relative(root,file).replaceAll('\\','/'),record};
}
export function reviewStatus(root=process.cwd()){
  const context=reviewContext(root),dir=resolve(root,'artifacts/uat/reviews'),records=existsSync(dir)?readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>read(resolve(dir,n))):[];
  return roles.map(role=>{
    const record=records.filter(r=>r.role===role).sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at)).at(-1);
    if(!record)return {role,human_acceptance:'pending'};
    let evidenceCurrent=true;for(const ref of record.evidence_files){try{if(evidenceFile(ref.path,root).sha256!==ref.sha256)evidenceCurrent=false;}catch{evidenceCurrent=false;}}
    const worksheet=read(resolve(root,'artifacts/uat',role+'.json')),worksheetCurrent=record.worksheet_fingerprint===worksheetFingerprint(worksheet);
    return {role,human_acceptance:record.context.fingerprint!==context.fingerprint||!evidenceCurrent||!worksheetCurrent?'stale_review':record.decision,reviewer:record.reviewer,reviewed_at:record.reviewed_at,record_id:record.id,evidence_current:evidenceCurrent,worksheet_current:worksheetCurrent,scope:record.scope};
  });
}
