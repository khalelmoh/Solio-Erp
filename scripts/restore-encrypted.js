import {restoreEncryptedBackup} from '../src/recovery.js';
if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER)){await (await import('./postgres-tools.js')).postgresTool('restore',process.argv.slice(2));}else{
if(!process.argv[2]||!process.argv[3])throw Error('Usage: npm run restore:encrypted -- archive.erpbackup unused-isolated.sqlite');
console.log(JSON.stringify(restoreEncryptedBackup(process.argv[2],process.argv[3]),null,2));

}