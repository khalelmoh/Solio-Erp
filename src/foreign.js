// The organization operates in USD only. Historical schema tables stay intact.
export function currencyMethods({base,fail}){
  return {
    assertUSD(data){const pending=[data];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;if('currency' in value&&value.currency!=='USD')fail('This ERP supports USD only');for(const child of Object.values(value))if(child&&typeof child==='object')pending.push(child);}},
    cashAccount(id){const account=base.cashAccount.call(this,id),currency=this.get('SELECT currency FROM account_currencies WHERE account_id=?',id)?.currency;if(currency&&currency!=='USD')fail('This ERP supports USD cash accounts only');return account;},
    journal(actor,data){const balances=new Map();for(const line of data.lines){const key=line.project_id+':'+line.source_id;balances.set(key,(balances.get(key)||0)+line.amount);const account=this.get('SELECT type FROM accounts WHERE id=?',line.account_id);if(account&&['bank','cash','mobile'].includes(account.type))this.cashAccount(line.account_id);}if([...balances.values()].some(amount=>amount))fail('Journal must balance within each project and funding source');return base.journal.call(this,actor,data);},
    defineCurrency(actor){this.admin(actor);fail('This ERP supports USD only; additional currencies are disabled');},
    recordRate(actor){this.admin(actor);fail('This ERP supports USD only; exchange rates are disabled');},
    foreignBill(actor){this.user(actor);fail('This ERP supports USD only; use the USD supplier bill workflow');},
    foreignOverview(actor){this.user(actor);return{currency:'USD',scale:2,currencies:[{code:'USD',scale:2}],rates:[],documents:[]};}
  };
}
