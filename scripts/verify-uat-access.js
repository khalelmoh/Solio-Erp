import {DatabaseSync} from 'node:sqlite';
import {readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,basename} from 'node:path';
import {scryptSync,timingSafeEqual} from 'node:crypto';

// Read-only diagnosis of the recorded local synthetic environment. Never opens main.
const session=JSON.parse(readFileSync('artifacts/uat/stage7-session.json','utf8'));
const path=realpathSync(session.database);
if(dirname(path)!==realpathSync('data')||!/^uat-[a-f0-9-]+\.sqlite$/.test(basename(path)))throw Error('Recorded isolated UAT database required');
const db=new DatabaseSync(path,{readOnly:true});
let result;
try{
  if(db.prepare('SELECT quarantined FROM release_environment WHERE id=1').get()?.quarantined!==1)throw Error('Synthetic quarantine required');
  result={checked_at:new Date().toISOString(),database:path,read_only:true,quarantined:true,accounts:['admin','manager','finance','requester'].map(role=>{
    const email=role+'@demo.erp',u=db.prepare('SELECT id,name,salt,password_hash FROM users WHERE email=?').get(email);
    return{role,email,exists:!!u,name:u?.name,documented_demo_password_matches:!!u&&timingSafeEqual(scryptSync('Demo-only-2026!',u.salt,64),Buffer.from(u.password_hash,'hex')),access_enabled:u?db.prepare('SELECT enabled FROM user_access_events WHERE user_id=? ORDER BY id DESC LIMIT 1').get(u.id)?.enabled!==0:false,mfa_enabled:!!u&&!!db.prepare('SELECT 1 FROM user_mfa WHERE user_id=? AND enabled=1').get(u.id)};
  })};
}finally{db.close();}
try{const r=await fetch(session.url+'/api/health',{signal:AbortSignal.timeout(5000)});result.runtime={reachable:true,status:r.status,health:await r.json()};}catch{result.runtime={reachable:false};}
writeFileSync('artifacts/uat/stage7-access-diagnosis.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
