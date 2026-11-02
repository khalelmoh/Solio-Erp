export const retentionColumns={
  ops_provider_jobs:['payload_encrypted'],
  el_candidates:['code','email_hash','user_id','payload_encrypted'],el_scores:['payload_encrypted','score'],el_interviews:['location'],el_hiring_decisions:['payload_encrypted'],el_documents:['payload_encrypted'],el_events:['payload_encrypted'],el_files:['filename','content_encrypted'],el_reviews:['goals'],el_review_events:['payload_encrypted','score'],hr_documents:['filename','content_encrypted'],hr_profiles:['private_encrypted'],el_self_requests:['payload_encrypted']
};
export function installRetentionGuards(db){
  db.exec('BEGIN IMMEDIATE');try{
    for(const [table,allowed]of Object.entries(retentionColumns)){
      const stable=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name).filter(k=>!allowed.includes(k));
      db.exec(`DROP TRIGGER IF EXISTS immutable_${table}_UPDATE; CREATE TRIGGER immutable_${table}_UPDATE BEFORE UPDATE ${table==='ops_provider_jobs'?'OF payload_encrypted ':''}ON ${table} WHEN NOT EXISTS(SELECT 1 FROM ops_erasure_permits p JOIN ops_retention_runs r ON r.id=p.run_id WHERE p.table_name='${table}' AND p.row_id=OLD.id) OR ${stable.map(k=>`NEW."${k}" IS NOT OLD."${k}"`).join(' OR ')} BEGIN SELECT RAISE(ABORT,'Immutable evidence; approved retention permit required for private payload only'); END;`);
    }
    for(const table of ['ops_rehire_proposals','ops_rehires','ops_revocations','ops_policy_formulas','ops_final_calculations','ops_setup_runs','ops_retention_rules','ops_retention_approvals','ops_holds','ops_retention_runs','ops_erasures','ops_provider_checks'])for(const op of ['UPDATE','DELETE'])db.exec(`CREATE TRIGGER IF NOT EXISTS immutable_${table}_${op} BEFORE ${op} ON ${table} BEGIN SELECT RAISE(ABORT,'Immutable operations evidence'); END;`);
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
}
