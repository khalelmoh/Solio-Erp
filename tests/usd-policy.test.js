import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {fixture} from './helpers.js';
import {createApp} from '../src/server.js';

test('database rejects new foreign evidence and mutation of USD currency scale',()=>{
  const f=fixture();try{
    assert.throws(()=>f.erp.run("INSERT INTO currency_definitions(code,scale) VALUES('EUR',2)"),/USD only/);
    assert.throws(()=>f.erp.run("UPDATE currency_definitions SET scale=3 WHERE code='USD'"),/Immutable/);
    assert.throws(()=>f.erp.run("DELETE FROM currency_definitions WHERE code='USD'"),/Immutable/);
    assert.throws(()=>f.erp.run("INSERT INTO fx_rates(currency,date,numerator,denominator,reference,reason,actor_id) VALUES('USD','2026-03-01','1','1','SQL-FX','Invalid conversion',?)",f.demo.users.admin),/exchange rates are disabled/);
    const account=f.op('admin','account.create',{code:'USD-BANK-2',name:'Second USD bank',type:'bank',currency:'USD'}).id;
    assert.throws(()=>f.erp.run("INSERT INTO account_currencies(account_id,currency) VALUES(?,'EUR')",account),/USD cash accounts only/);
    f.erp.run("INSERT INTO account_currencies(account_id,currency) VALUES(?,'USD')",account);
    assert.throws(()=>f.erp.run("UPDATE account_currencies SET currency='EUR' WHERE account_id=?",account),/Immutable/);
    assert.throws(()=>f.erp.run('DELETE FROM account_currencies WHERE account_id=?',account),/Immutable/);
    assert.equal(f.erp.config(f.demo.users.finance).currency,'USD');
    assert.equal(f.erp.foreignOverview(f.demo.users.finance).rates.length,0);
    const adjustment=f.op('finance','adjustment.submit',{original_id:f.erp.get('SELECT journal_id FROM bills WHERE id=?',f.demo.bill).journal_id,reference:'EXPLICIT-USD-ACCOUNT',date:'2026-03-01',reason:'Transfer between USD accounts',charges:[],lines:[{project_id:f.demo.project,source_id:f.demo.source,account_id:account,amount:'1.00'},{project_id:f.demo.project,source_id:f.demo.source,account_id:1,amount:'-1.00'}]}).id;
    f.op('manager','adjustment.approve',{id:adjustment});f.op('finance','adjustment.post',{id:adjustment});assert.equal(f.erp.cash(f.demo.project,f.demo.source,account),100);assert.equal(f.erp.metrics(f.demo.project).cash,3600000);
  }finally{f.cleanup();}
});

test('signed provider events reject non-USD amounts without storing a receipt or consuming the external ID',()=>{
  const f=fixture();
  try{
    const secret='u'.repeat(40),id=f.op('admin','integration.configure',{name:'USD-ONLY-PROVIDER',endpoint:'https://provider.example.invalid/events',secret,enabled:true}).id;
    f.op('admin','integration.route',{integration_id:id,external_source:'DONOR-USD',source_id:f.demo.source,account_id:1,poster_id:f.demo.users.finance});
    const timestamp=String(Math.floor(Date.now()/1000)),post=data=>{const raw=JSON.stringify(data),signature=createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');return f.erp.inbound(id,raw,timestamp,signature);};
    const data={event:'funding.received',external_id:'CURRENCY-CHECK',external_source:'DONOR-USD',amount:'100.00',date:'2026-03-01',currency:'EUR'},before=f.erp.metrics(f.demo.project);
    assert.throws(()=>post(data),/USD only/);assert.deepEqual(f.erp.metrics(f.demo.project),before);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM integration_events').n,0);
    const accepted=post({...data,currency:'USD'});assert.deepEqual(post({...data,currency:'USD'}),accepted);assert.equal(f.erp.metrics(f.demo.project).cash,before.cash+10000);assert.equal(f.erp.get('SELECT COUNT(*) AS n FROM integration_events').n,1);
  }finally{f.cleanup();}
});

test('HTTP clients cannot bypass USD-only policy and currency setup no longer appears in the interface',async()=>{
  const f=fixture(),server=createApp(f.db);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const origin=`http://127.0.0.1:${server.address().port}`,login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@demo.erp',password:'Demo-only-2026!'})}),cookie=login.headers.get('set-cookie').split(';')[0];assert.equal(login.status,200);
    const response=await fetch(origin+'/api/actions',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'Idempotency-Key':randomUUID()},body:JSON.stringify({action:'account.create',data:{code:'FOREIGN-HTTP',name:'Foreign account',type:'bank',currency:'EUR'}})});assert.equal(response.status,400);assert.match((await response.json()).error,/USD only/);assert.ok(!f.erp.get("SELECT 1 FROM accounts WHERE code='FOREIGN-HTTP'"));
    const config=await(await fetch(origin+'/api/config',{headers:{Cookie:cookie}})).json();assert.equal(config.currency,'USD');assert.equal(config.currency_scale,2);
    const ui=await(await fetch(origin+'/completion-ui.js')).text();assert.doesNotMatch(ui,/Define currency|Record FX rate|Post foreign invoice/);assert.match(ui,/Organization currency/);
  }finally{await new Promise(resolve=>server.close(resolve));f.cleanup();}
});
