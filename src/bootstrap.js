import {randomBytes,createHash} from 'node:crypto';
import {writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {seal,base32} from './secure.js';
import {restrictFile} from './private-files.js';

export function bootstrapAdministrator(erp,{email,password,name='Organization Administrator',mfaFile,production=false}={}){
  if(erp.get('SELECT COUNT(*) AS n FROM users').n)throw Error('Initialization requires an empty user database; existing users preserved');
  if(production&&password==='Demo-only-2026!')throw Error('Demonstration credentials are prohibited in production');
  if(production&&!mfaFile)throw Error('Production initialization requires a protected ERP_ADMIN_MFA_SEED_FILE');
  if(mfaFile&&existsSync(mfaFile))throw Error('Use an unused private MFA enrollment file');let wrote=false;
  erp.db.exec('BEGIN IMMEDIATE');try{
    const id=erp.createUser({name,email,password,admin:true});
    if(mfaFile){const secret=base32(randomBytes(20)),recovery_codes=Array.from({length:10},()=>randomBytes(8).toString('hex'));for(const code of recovery_codes)erp.insert('mfa_recovery',{user_id:id,code_hash:createHash('sha256').update(code).digest('hex')});writeFileSync(mfaFile,JSON.stringify({user_id:id,issuer:'Folio',email,secret,recovery_codes,uri:`otpauth://totp/Folio:${encodeURIComponent(email)}?secret=${secret}&issuer=Folio&digits=6&period=30`,instructions:'Import into your authenticator privately, verify login, then securely remove this bootstrap file. Keep recovery codes in your separate approved recovery store.'},null,2),{flag:'wx',mode:0o600});wrote=true;restrictFile(mfaFile);erp.insert('user_mfa',{user_id:id,secret_encrypted:seal(erp.db,{secret},`mfa:${id}`),enabled:1});}
    erp.insert('audit',{actor_id:id,action:'security.bootstrap',entity:String(id),details:JSON.stringify({mfa_enrollment_created:!!mfaFile})});erp.db.exec('COMMIT');return{id,mfa_enrollment_created:!!mfaFile};
  }catch(e){erp.db.exec('ROLLBACK');if(wrote)unlinkSync(mfaFile);throw e;}
}
