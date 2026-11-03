import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {requireImplementedDatabase} from './database-provider.js';

export function validateSessionCookieName(name){
  if(!/^erp_[a-z0-9_]{1,48}$/.test(name))throw Error('Invalid application session cookie name');
  return name;
}

export function stagingPasswordOnlyAdministrator(user,env=process.env){
  return env.ERP_STAGING_SYNTHETIC_ONLY==='true'&&env.ERP_TRANSPORTS_ENABLED==='false'&&!!user.admin&&typeof env.ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL==='string'&&env.ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL.trim().toLowerCase()===user.email.toLowerCase();
}

export function runtimeConfig(env=process.env){
  requireImplementedDatabase(env);
  if(env.VERCEL==='1')throw new Error('Deploy the static interface with build:vercel; the SQLite backend requires persistent storage outside Vercel Functions');
  const boolean=(name,fallback=false)=>{const value=env[name];if(value===undefined||value==='')return fallback;if(!['true','false'].includes(value))throw new Error(`${name} must be true or false`);return value==='true';};
  const integer=(name,fallback,min,max)=>{const value=env[name]??String(fallback);if(!/^\d+$/.test(value)||Number(value)<min||Number(value)>max)throw new Error(`${name} must be an integer from ${min} to ${max}`);return Number(value);};
  const timezone=env.ERP_TIMEZONE||'Africa/Mogadishu';try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{throw new Error('ERP_TIMEZONE must be a valid IANA timezone');}
  const secureCookies=boolean('ERP_SECURE_COOKIES'),enabled=boolean('ERP_JOBS_ENABLED'),transportsEnabled=boolean('ERP_TRANSPORTS_ENABLED'),actor=env.ERP_WORKER_USER?integer('ERP_WORKER_USER',0,1,Number.MAX_SAFE_INTEGER):null;
  const syntheticStaging=boolean('ERP_STAGING_SYNTHETIC_ONLY');
  if(syntheticStaging&&transportsEnabled)throw new Error('Synthetic staging requires ERP_TRANSPORTS_ENABLED=false');
  if(env.ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL){
    if(!syntheticStaging||env.ERP_TRANSPORTS_ENABLED!=='false')throw new Error('Password-only staging administrator requires synthetic-only mode and explicitly disabled transports');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL)||env.ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL.length>254)throw new Error('Configure exactly one password-only staging administrator email');
  }
  if(enabled&&!actor)throw new Error('ERP_JOBS_ENABLED requires an authorized ERP_WORKER_USER');
  if(env.NODE_ENV==='production'){
    let origin;try{origin=new URL(env.ERP_PUBLIC_ORIGIN);}catch{throw new Error('Production requires ERP_PUBLIC_ORIGIN');}
    if(origin.protocol!=='https:'||origin.username||origin.password||!secureCookies)throw new Error('Production requires HTTPS and secure session cookies');
    if(!env.ERP_MASTER_KEY&&!env.ERP_MASTER_KEY_FILE)throw new Error('Production requires an external master key');
    if(boolean('ERP_ALLOW_LOCAL_TRANSPORT'))throw new Error('Local insecure transport fixtures are prohibited in production');
  }
  return{host:env.HOST||'127.0.0.1',port:integer('PORT',3000,1,65535),timezone,secureCookies,jobs:{enabled,actor,interval:integer('ERP_JOB_INTERVAL_SECONDS',300,5,86400)*1000,transportsEnabled}};
}

export function setupEnvironment({directory,template,database}){
  const destination=resolve(directory,'.env');if(existsSync(destination))return{created:false,demo_jobs_enabled:false};
  let content=readFileSync(template,'utf8'),admin=null;
  if(existsSync(database)){const db=new DatabaseSync(database,{readOnly:true});try{if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get())admin=db.prepare("SELECT id FROM users WHERE admin=1 AND email='admin@demo.erp'").get()?.id;}finally{db.close();}}
  if(admin){content=content.replace('ERP_JOBS_ENABLED=false','ERP_JOBS_ENABLED=true').replace('# ERP_WORKER_USER=','ERP_WORKER_USER='+admin);}
  try{writeFileSync(destination,content,{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')return{created:false,demo_jobs_enabled:false};throw e;}
  return{created:true,demo_jobs_enabled:!!admin};
}
