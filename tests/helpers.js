import { mkdtempSync, rmSync } from 'node:fs';
import { join,dirname,resolve,basename } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db.js';
import { ERP } from '../src/service.js';
import { seedDemo } from '../src/demo.js';
export function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'folio-test-')),path=join(dir,'test.sqlite'),db=openDatabase(path),erp=new ERP(db),demo=seedDemo(db);
  const op=(role,action,data,key=randomUUID())=>erp.execute(demo.users[role],action,data,key);
  const spending=(amount='1000.00',extra={})=>op('requester','request.submit',{title:'Control test request',date:'2026-03-01',lines:[{project_id:demo.project,source_id:demo.source,category:'Equipment',activity:'Outreach',amount}],...extra}).id;
  return {db,erp,demo,op,spending,path,cleanup(){db.close();if(dirname(resolve(dir))!==resolve(tmpdir()) || !basename(dir).startsWith('folio-test-'))throw new Error('Unsafe fixture cleanup path');rmSync(dir,{recursive:true,force:true});}};
}
