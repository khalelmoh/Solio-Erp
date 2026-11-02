import { openDatabase, defaultPath } from '../src/db.js';
import { ERP } from '../src/service.js';
import {bootstrapAdministrator} from '../src/bootstrap.js';
if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER)){await (await import('./postgres-tools.js')).postgresTool('init');}else{
const db=openDatabase(process.env.ERP_DB||defaultPath);
try {
  if(db.prepare('SELECT COUNT(*) AS n FROM users').get().n) throw new Error('Initialization requires an empty user database; existing users were preserved');
  if(!process.env.ERP_ADMIN_EMAIL || !process.env.ERP_ADMIN_PASSWORD) throw new Error('Set ERP_ADMIN_EMAIL and ERP_ADMIN_PASSWORD (minimum 12 characters) before initialization');
  const result=bootstrapAdministrator(new ERP(db),{name:process.env.ERP_ADMIN_NAME,email:process.env.ERP_ADMIN_EMAIL,password:process.env.ERP_ADMIN_PASSWORD,mfaFile:process.env.ERP_ADMIN_MFA_SEED_FILE,production:process.env.NODE_ENV==='production'});
  console.log('Administrator created:',result.id,'; MFA enrollment created:',result.mfa_enrollment_created);
  console.log('Sign in and configure approval policies, accounting periods, users and project memberships before posting. No thresholds or payroll policies were invented.');
} finally { db.close(); }

}