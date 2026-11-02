import {randomBytes,createCipheriv,createDecipheriv,createHmac} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';

function key(db) {
  if(db.erpMasterKey){if(!Buffer.isBuffer(db.erpMasterKey)||db.erpMasterKey.length!==32)throw Error('Invalid PostgreSQL record key');return db.erpMasterKey;}
  if(process.env.ERP_MASTER_KEY){const k=Buffer.from(process.env.ERP_MASTER_KEY,'hex');if(k.length!==32||!/^[a-f0-9]{64}$/i.test(process.env.ERP_MASTER_KEY))throw new Error('ERP_MASTER_KEY must be 64 hexadecimal characters');return k;}
  if(process.env.ERP_MASTER_KEY_FILE){const k=Buffer.from(readFileSync(process.env.ERP_MASTER_KEY_FILE,'utf8').trim(),'hex');if(k.length!==32)throw new Error('Invalid master key file');return k;}
  if(process.env.NODE_ENV==='production')throw new Error('Production requires an external ERP_MASTER_KEY or key file');
  if(!db.erpPath){db.ephemeralKey??=randomBytes(32);return db.ephemeralKey;}
  const path=db.erpPath+'.key';
  if(!existsSync(path)){
    if(db.prepare('SELECT COUNT(*) AS n FROM employees').get().n||db.prepare('SELECT COUNT(*) AS n FROM user_mfa').get().n||db.prepare('SELECT COUNT(*) AS n FROM integrations').get().n||db.prepare('SELECT COUNT(*) AS n FROM oidc_attempts').get().n||db.prepare("SELECT 1 FROM operations WHERE payload_hash LIKE 'hmac:%' LIMIT 1").get())throw new Error('Encrypted records exist but the database master key is missing; restore the matching key');
    try{writeFileSync(path,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  }
  const k=Buffer.from(readFileSync(path,'utf8').trim(),'hex');if(k.length!==32)throw new Error('Invalid database master key');return k;
}
export function seal(db,value,purpose){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(db),iv);cipher.setAAD(Buffer.from(purpose));const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')});}
export function unseal(db,value,purpose){const encrypted=JSON.parse(value),decipher=createDecipheriv('aes-256-gcm',key(db),Buffer.from(encrypted.iv,'base64'));decipher.setAAD(Buffer.from(purpose));decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data,'base64')),decipher.final()]).toString('utf8'));}
export function fingerprint(db,value){return 'hmac:'+createHmac('sha256',key(db)).update('operation-payload:'+value).digest('hex');}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes){let bits=0,buffer=0,out='';for(const n of bytes){buffer=(buffer<<8)|n;bits+=8;while(bits>=5){out+=alphabet[(buffer>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(buffer<<(5-bits))&31];return out;}
export function decode32(value){let bits=0,buffer=0;const out=[];for(const c of value.toUpperCase()){const n=alphabet.indexOf(c);if(n<0)throw new Error('Invalid authenticator secret');buffer=(buffer<<5)|n;bits+=5;if(bits>=8){out.push((buffer>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
export function totp(secret,counter){const bytes=Buffer.alloc(8);bytes.writeBigUInt64BE(BigInt(counter));const h=createHmac('sha1',decode32(secret)).update(bytes).digest(),offset=h[19]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
