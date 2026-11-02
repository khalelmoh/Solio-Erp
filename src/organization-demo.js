import {randomUUID} from 'node:crypto';
import {seedAccountingDemo} from './accounting-demo.js';
import {ERP} from './service.js';

export function seedOrganizationDemo(db){
  const demo=seedAccountingDemo(db),e=new ERP(db),op=(role,action,data)=>e.execute(demo.users[role],action,data,randomUUID());
  const department=op('admin','org.unit',{kind:'department',code:'ADMIN',name:'Administration'}).id,costCentre=op('admin','org.unit',{kind:'cost_centre',code:'HQ',name:'Head office'}).id;
  const fund=op('finance','org.fund',{code:'GENERAL-2026',name:'Synthetic unrestricted organization fund',restricted:false,categories:[],start_date:'2026-01-01',end_date:'2026-12-31',treatment:'income',recognize_receivable:true,allow_transfers:true,reason:'SYNTHETIC DEMO ONLY: income on receipt; documented receivables independently approved; no statutory or real policy approval implied'}).id;op('manager','org.fund.approve',{id:fund});
  const budget=op('finance','org.budget',{code:'OPS-2026',name:'Synthetic general operating budget',start_date:'2026-01-01',end_date:'2026-12-31',mode:'independent',lines:[{category:'RENT',amount:'10000.00'},{category:'ADMIN',amount:'10000.00'},{category:'UTILITIES',amount:'5000.00'}],reason:'Synthetic demonstration spending authority'}).id;op('manager','org.budget.approve',{id:budget});
  const post=(kind,data={})=>{const id=op('finance','org.document',{kind,reference:'ORG-DEMO-'+kind.toUpperCase(),date:'2026-04-01',reason:'Synthetic organization finance example',org_fund_id:fund,department_id:department,cost_centre_id:costCentre,amount:'1000.00',...data}).id;op('manager','acc.document.approve',{id});return op('finance','acc.document.post',{id});};
  post('receipt',{receipt_type:'donation',amount:'20000.00',account_id:1});const bill=post('bill',{budget_code:'OPS-2026',category:'RENT',party:'Synthetic office landlord',external_reference:'ORG-DEMO-RENT-INVOICE',due_date:'2026-04-30',documents:[{filename:'synthetic-rent.txt',mime:'text/plain',content:Buffer.from('SYNTHETIC ONLY: office rent invoice for USD1000. Not a real supplier document.').toString('base64')}]});const item=e.get('SELECT id FROM org_items WHERE document_id=?',bill.id).id;post('payment',{item_id:item,account_id:1,amount:'400.00'});
  return{...demo,organization:{fund,budget,bill_id:bill.id,item_id:item,department_id:department,cost_centre_id:costCentre}};
}
