import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export async function migratePostgres(db,{snapshot=null,through=null}={}){
  return db.withSession(async()=>{
    await db.exec('BEGIN IMMEDIATE');
    try{
      await db.query('CREATE SCHEMA IF NOT EXISTS "'+db.schema+'"');await db.query('SET LOCAL search_path TO "'+db.schema+'", pg_catalog');
      await db.query('CREATE TABLE IF NOT EXISTS pg_migrations(name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
      const keyHash=createHash('sha256').update(db.erpMasterKey).digest('hex');
      if((await db.query("SELECT to_regclass('pg_record_key') AS present")).rows[0].present){const stored=(await db.query('SELECT sha256 FROM pg_record_key WHERE id=true')).rows[0];if(stored&&stored.sha256!==keyHash)throw Error('PostgreSQL record key does not match this database');}
      for(const name of readdirSync(new URL('../migrations/postgres/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
        if(through&&name>through)continue;
        const content=readFileSync(new URL('../migrations/postgres/'+name,import.meta.url),'utf8'),hash=createHash('sha256').update(content).digest('hex'),old=(await db.query('SELECT sha256 FROM pg_migrations WHERE name=$1',[name])).rows[0];
        if(old){if(old.sha256!==hash)throw Error('Applied PostgreSQL migration checksum changed: '+name);continue;}
        const sql=content.replaceAll(':SCHEMA:','"'+db.schema+'"');
        if(snapshot&&name==='001_schema13.sql'){
          const begin=sql.indexOf('-- BEGIN_BASELINE_SEED'),end=sql.indexOf('-- END_BASELINE_SEED');if(begin<0||end<begin)throw Error('Migration snapshot initialization markers missing');
          if((await db.query('SELECT COUNT(*) AS n FROM pg_migrations')).rows[0].n)throw Error('Snapshot import requires a new isolated schema');
          await db.query(sql.slice(0,begin));
          for(const table of snapshot.tables){if(table.name==='pg_migrations')continue;if(!/^[a-z][a-z0-9_]+$/.test(table.name))throw Error('Invalid snapshot table');for(const row of table.rows){const keys=Object.keys(row);if(keys.some(k=>!/^\w+$/.test(k)))throw Error('Invalid snapshot column');const values=keys.map(k=>row[k]?.bytea!==undefined?Buffer.from(row[k].bytea,'base64'):row[k]);await db.query('INSERT INTO "'+table.name+'"('+keys.map(k=>'"'+k+'"').join(',')+') VALUES('+values.map((_,i)=>'$'+(i+1)).join(',')+')',values);}}
          for(const table of snapshot.tables.filter(t=>t.columns?.some(c=>c.name==='id'&&c.pk))){await db.query("SELECT setval(pg_get_serial_sequence($1,'id'),COALESCE(MAX(id),1),MAX(id) IS NOT NULL) FROM \""+table.name+'"',[table.name]);}
          await db.query(sql.slice(end));
        }else await db.query(sql);
        if(name==='004_record_key.sql')await db.query('INSERT INTO pg_record_key(id,sha256) VALUES(true,$1)',[keyHash]);
        await db.query('INSERT INTO pg_migrations(name,sha256) VALUES($1,$2)',[name,hash]);
      }
      await db.query('REVOKE ALL ON pg_migrations FROM PUBLIC');await db.query('GRANT SELECT ON pg_migrations TO erp_backend');
      await db.exec('COMMIT');
      db.identities=new Set((await db.query("SELECT table_name FROM information_schema.columns WHERE table_schema=$1 AND column_name='id' AND is_identity='YES'",[db.schema])).rows.map(r=>r.table_name));
      return(await db.query('SELECT name,sha256 FROM pg_migrations ORDER BY name')).rows;
    }catch(e){await db.exec('ROLLBACK');throw e;}
  });
}
