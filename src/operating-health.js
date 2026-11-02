import {readFileSync,statSync} from 'node:fs';
export function backupHealth(){
  const path=process.env.ERP_BACKUP_STATUS_FILE||'data/backup-status.json',hours=Number(process.env.ERP_BACKUP_MAX_AGE_HOURS||24);
  try{if(statSync(path).size>4096)throw Error();const status=JSON.parse(readFileSync(path,'utf8')),age=Date.now()-Date.parse(status.captured_at),recent=status.ok===true&&Number.isFinite(age)&&age>=0&&age<=hours*3600000;return{configured:!!process.env.ERP_BACKUP_KEY_FILE,ok:recent,last_check:status.checked_at||null,last_recoverable_snapshot:status.captured_at||null,max_age_hours:hours,message:recent?'Latest backup is within the configured age; restore verification is separate':'Backup failed or is stale; operator action required'};}catch{return{configured:!!process.env.ERP_BACKUP_KEY_FILE,ok:false,max_age_hours:hours,message:'No readable backup status; configure and monitor encrypted backups'};}
}
