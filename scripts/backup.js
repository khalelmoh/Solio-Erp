import {defaultPath} from '../src/db.js';
import {backupDatabase} from '../src/backup.js';
console.log(JSON.stringify(backupDatabase(process.env.ERP_DB||defaultPath,process.argv[2]||'data/backup-'+Date.now()+'.sqlite')));
