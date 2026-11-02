import { openDatabase, defaultPath } from '../src/db.js';
if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER)){await import('./postgres-migrate.js');}else{
const path = process.env.ERP_DB || defaultPath;
const db = openDatabase(path);
console.log('Database migrated:', path);
console.log(db.prepare('SELECT * FROM schema_migrations').all());
db.close();

}