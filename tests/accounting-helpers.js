import {mkdtempSync,rmSync} from 'node:fs';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../src/db.js';
import {ERP} from '../src/service.js';
import {seedAccountingDemo} from '../src/accounting-demo.js';
export function accountingFixture(){const dir=mkdtempSync(join(tmpdir(),'folio-accounting-')),path=join(dir,'test.sqlite'),db=openDatabase(path),demo=seedAccountingDemo(db),erp=new ERP(db),op=(role,action,data,key=randomUUID())=>erp.execute(demo.users[role],action,data,key);return{db,erp,demo,op,path,cleanup(){db.close();if(dirname(resolve(dir))!==resolve(tmpdir())||!basename(dir).startsWith('folio-accounting-'))throw new Error('Unsafe accounting fixture cleanup');rmSync(dir,{recursive:true,force:true});}};}
