import {openPostgres} from '../src/postgres-db.js';
import {migratePostgres} from '../src/postgres-migrations.js';
const db=await openPostgres(null,{owner:true});try{console.log(JSON.stringify({provider:'postgres',migrations:await migratePostgres(db)}));}finally{await db.close();}
