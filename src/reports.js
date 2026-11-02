import { exportCSV } from './csv.js';

export function reportMethods({base,fail,date,decimal,sum,today,parseMoney}) {
  return {
    sourceBalances(project,to='9999-12-31') {
      return this.all('SELECT * FROM funding_sources WHERE project_id=?',project).map(s=>{
        const promised=this.get('SELECT COALESCE(SUM(amount),0) AS n FROM promises WHERE source_id=? AND date<=?',s.id,to).n+this.get('SELECT COALESCE(SUM(pa.amount),0) AS n FROM promise_adjustments pa JOIN promises p ON p.id=pa.promise_id WHERE p.source_id=? AND pa.date<=?',s.id,to).n;
        const funding=this.all("SELECT j.kind,j.reversal_of,l.amount FROM journal_lines l JOIN journals j ON j.id=l.journal_id JOIN accounts a ON a.id=l.account_id WHERE l.source_id=? AND a.type='funding' AND j.date<=?",s.id,to);
        const isOriginal=(j,kind)=>j.kind===kind||(j.reversal_of&&this.get('SELECT kind FROM journals WHERE id=?',j.reversal_of)?.kind===kind);
        const received=0-sum(funding.filter(j=>isOriginal(j,'receipt')).map(j=>j.amount)),returned=sum(funding.filter(j=>isOriginal(j,'funding_return')).map(j=>j.amount));
        const cash=this.get("SELECT COALESCE(SUM(l.amount),0) AS n FROM journal_lines l JOIN journals j ON j.id=l.journal_id JOIN accounts a ON a.id=l.account_id WHERE l.source_id=? AND a.type IN('bank','cash','mobile') AND j.date<=?",s.id,to).n;
        return{...s,categories:JSON.parse(s.categories),promised,received,returned,cash,outstanding:Math.max(0,promised-received)};
      });
    },
    metrics(project) {
      const m=base.metrics.call(this,project),sources=this.sourceBalances(project);return{...m,promised:sum(sources.map(s=>s.promised)),received:sum(sources.map(s=>s.received))};
    },
    closeout(project) {
      const p=this.get('SELECT * FROM projects WHERE id=?',project);if(!p)fail('Unknown project');const blockers=[];
      const add=(key,type,amount,description,source_id=null)=>blockers.push({key,type,amount,description,source_id});
      for(const l of this.all('SELECT l.*,r.kind,r.title FROM request_lines l JOIN requests r ON r.id=l.request_id WHERE l.project_id=?',project)) {const n=this.balance(l.id);if(n)add(`commitment:${l.id}`,'commitment',n,`${l.kind==='advance'?'Advance reservation':'Spending commitment'}: ${l.title}`,l.source_id);}
      for(const b of this.all('SELECT DISTINCT b.* FROM bills b JOIN bill_lines bl ON bl.bill_id=b.id JOIN request_lines l ON l.id=bl.request_line_id WHERE l.project_id=?',project)){const n=this.projectUnpaid(b,project);if(n)add(`bill:${b.id}`,'liability',n,`Unpaid supplier bill ${b.invoice}`);}
      for(const credit of this.all('SELECT DISTINCT c.* FROM credit_notes c JOIN credit_lines cl ON cl.credit_id=c.id JOIN bill_lines bl ON bl.id=cl.bill_line_id JOIN request_lines l ON l.id=bl.request_line_id WHERE l.project_id=?',project)){const n=sum(this.refundAllocations(credit).filter(l=>l.project_id===project).map(l=>l.outstanding));if(n)add(`supplier-credit:${credit.id}`,'supplier_receivable',n,`Supplier refund outstanding: ${credit.reference}`);}
      for(const a of this.advanceDetails(null,project)){const n=parseMoney(a.outstanding,{zero:true});if(n)add(`advance:${a.id}`,'advance',n,`Outstanding advance: ${a.beneficiary} (due ${a.due_date})`);}
      const cashLines=this.all("SELECT l.*,j.reference FROM journal_lines l JOIN journals j ON j.id=l.journal_id JOIN accounts a ON a.id=l.account_id WHERE l.project_id=? AND a.type IN('bank','cash','mobile') ORDER BY l.id",project);
      for(const l of cashLines){const n=Math.abs(l.amount)-this.matchedBook(l.id,true);if(n)add(`cash-line:${l.id}`,'reconciliation',Math.sign(l.amount)*n,`Unmatched cash line #${l.id}: ${l.reference}`,l.source_id);}
      for(const account of new Set(cashLines.map(l=>l.account_id)))for(const s of this.all('SELECT * FROM statements WHERE account_id=?',account))if(this.statementState(s.id)!=='finalized')add(`statement:${s.id}`,'reconciliation',0,`Shared cash statement ${s.reference} is open`);
      for(const s of this.sourceBalances(project)){
        if(s.cash)add(`funding:${s.id}`,s.type==='donor'?'restricted_funding':'unrestricted_cash',s.cash,`${s.name}: residual cash allocation`,s.id);
        if(s.outstanding)add(`promise:${s.id}`,'funding_promise',s.outstanding,`${s.name}: unreceived promise requires a treatment`,s.id);
      }
      blockers.sort((a,b)=>a.key.localeCompare(b.key));
      return{operational_state:p.operational_state,financial_state:p.status,ready:p.operational_state==='completed'&&!blockers.length,blockers,history:this.all('SELECT e.*,u.name FROM project_events e JOIN users u ON u.id=e.actor_id WHERE e.project_id=? ORDER BY e.id',project),authorizations:this.all('SELECT a.id,a.closer_id,a.actor_id,a.expiry,a.reason,a.treatments,cu.event_id FROM closure_authorizations a LEFT JOIN closure_uses cu ON cu.authorization_id=a.id WHERE a.project_id=? ORDER BY a.id',project)};
    },
    enrichDashboard(actor,project,d) {
      for(const budget of d.budgets){budget.change=this.get('SELECT kind,details FROM budget_changes WHERE budget_id=?',budget.id);budget.documents=this.documents('budget',budget.id,actor);}
      for(const request of d.requests){request.terms=this.get('SELECT * FROM advance_requests WHERE request_id=?',request.id);request.documents=this.documents('request',request.id,actor);}
      for(const bill of d.bills){bill.due_date=bill.due_date||bill.date;bill.overdue=Number(bill.unpaid)>0&&bill.due_date<today();bill.documents=this.documents('bill',bill.id,actor);}
      d.advances=this.advanceDetails(actor,project);
      d.credits=this.all('SELECT DISTINCT c.*,b.invoice,b.supplier FROM credit_notes c JOIN bills b ON b.id=c.bill_id JOIN credit_lines cl ON cl.credit_id=c.id JOIN bill_lines bl ON bl.id=cl.bill_line_id JOIN request_lines l ON l.id=bl.request_line_id WHERE l.project_id=? ORDER BY c.id DESC',project).map(c=>({...c,amount:decimal(sum(this.all('SELECT cl.amount FROM credit_lines cl JOIN bill_lines bl ON bl.id=cl.bill_line_id JOIN request_lines l ON l.id=bl.request_line_id WHERE cl.credit_id=? AND l.project_id=?',c.id,project).map(l=>l.amount))),outstanding:decimal(sum(this.refundAllocations(c).filter(l=>l.project_id===project).map(l=>l.outstanding))),reversed:this.reversed(c.journal_id),documents:this.documents('credit',c.id,actor)}));
      d.closeout=this.closeout(project);d.closeout.blockers=d.closeout.blockers.map(b=>({...b,amount:decimal(b.amount)}));
      d.promises=this.all('SELECT p.* FROM promises p JOIN funding_sources s ON s.id=p.source_id WHERE s.project_id=? ORDER BY p.id',project).map(p=>({...p,amount:decimal(p.amount),remaining:decimal(p.amount+this.get('SELECT COALESCE(SUM(amount),0) AS n FROM promise_adjustments WHERE promise_id=?',p.id).n),adjustments:this.all('SELECT * FROM promise_adjustments WHERE promise_id=?',p.id).map(a=>({...a,amount:decimal(a.amount)}))}));
      const sources=this.sourceBalances(project);d.sources=sources.map(s=>({...s,promised:decimal(s.promised),received:decimal(s.received),returned:decimal(s.returned),cash:decimal(s.cash),outstanding:decimal(s.outstanding)}));
      const reservations=this.all('SELECT r.kind,EXISTS(SELECT 1 FROM advances a WHERE a.request_id=r.id) AS is_advance,EXISTS(SELECT 1 FROM purchase_orders po WHERE po.request_id=r.id) AS is_po,SUM(c.amount) AS n FROM commitments c JOIN request_lines l ON l.id=c.request_line_id JOIN requests r ON r.id=l.request_id WHERE l.project_id=? GROUP BY r.id',project);
      const advanceReserve=sum(reservations.filter(r=>r.kind==='advance'||r.is_advance).map(r=>r.n)),poReserve=sum(reservations.filter(r=>r.is_po).map(r=>r.n));
      Object.assign(d.metrics,{advance_reservations:decimal(advanceReserve),purchase_commitments:decimal(poReserve),other_reservations:decimal(parseMoney(d.metrics.commitment,{zero:true,signed:true})-advanceReserve-poReserve),funding_outstanding:decimal(sum(sources.map(s=>s.outstanding))),funding_returned:decimal(sum(sources.map(s=>s.returned))),supplier_receivables:decimal(sum(d.credits.map(c=>parseMoney(c.outstanding,{zero:true})))),overdue_bills:decimal(sum(d.bills.filter(b=>b.overdue).map(b=>parseMoney(b.unpaid,{zero:true})))),overdue_advances:decimal(sum(d.advances.filter(a=>a.overdue).map(a=>parseMoney(a.outstanding,{zero:true}))))});
      for(const j of d.transactions)j.documents=this.documents('journal',j.id,actor);
      return d;
    },
    config(actor) {
      const result=base.config.call(this,actor);result.timezone=process.env.ERP_TIMEZONE||'Africa/Mogadishu';if(result.user.admin){result.correction_authorizations=this.all('SELECT a.*,j.reference FROM correction_authorizations a JOIN journals j ON j.id=a.journal_id');result.statement_summaries=this.all('SELECT s.*,a.name AS account FROM statements s JOIN accounts a ON a.id=s.account_id ORDER BY s.id DESC').map(s=>({...s,state:this.statementState(s.id),opening_balance:decimal(s.opening_balance),closing_balance:decimal(s.closing_balance)}));}
      if(!result.user.admin)result.correction_authorizations=this.all('SELECT a.*,j.reference FROM correction_authorizations a JOIN journals j ON j.id=a.journal_id WHERE a.poster_id=?',actor);
      return result;
    },
    report(actor,project,filters={}) {
      this.db.exec('BEGIN');try{const result=this.reportData(actor,project,filters);this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}
    },
    reportData(actor,project,filters={}) {
      const p=this.project(actor,project),from=date(filters.from||p.start_date),to=date(filters.to||today());if(from>to)fail('Report date range is invalid');
      const source=filters.source_id?Number(filters.source_id):null,category=filters.category||null;
      if(source&&!this.get('SELECT id FROM funding_sources WHERE project_id=? AND id=?',project,source))fail('Funding source does not belong to this project');
      const budgets=this.all("SELECT b.* FROM budget_versions b WHERE b.project_id=? AND b.state='approved' AND (SELECT substr(MAX(a.created_at),1,10) FROM approvals a WHERE a.kind='budget' AND a.document_id=b.id)<=? ORDER BY b.version DESC",project,to),budget=budgets[0];
      const budgetLines=budget?this.all('SELECT * FROM budget_lines WHERE budget_id=? AND start_date<=? AND end_date>=?',budget.id,to,from).filter(l=>!category||l.category===category):[];
      const charges=this.all('SELECT c.*,l.project_id,l.source_id,l.category,l.activity,l.request_id,j.date AS posting_date,j.reference FROM budget_charges c JOIN request_lines l ON l.id=c.request_line_id JOIN journals j ON j.id=c.journal_id WHERE l.project_id=? AND j.date<=? ORDER BY j.date,c.id',project,to);
      const commitments=this.all('SELECT c.*,l.source_id,l.category,l.activity,l.request_id,r.kind,r.date AS allocation_date,r.title,EXISTS(SELECT 1 FROM advances a WHERE a.request_id=r.id) AS is_advance,EXISTS(SELECT 1 FROM purchase_orders po WHERE po.request_id=r.id) AS is_po FROM commitments c JOIN request_lines l ON l.id=c.request_line_id JOIN requests r ON r.id=l.request_id WHERE l.project_id=? AND c.effective_date<=? ORDER BY c.effective_date,c.id',project,to);
      const inScope=l=>(!source||l.source_id===source)&&(!category||l.category===category),scopedCharges=charges.filter(inScope),scopedCommitments=commitments.filter(inScope);
      const categoryRows=budgetLines.map(l=>{
        const fits=x=>x.category===l.category&&x.activity===l.activity&&(x.date||x.allocation_date)>=l.start_date&&(x.date||x.allocation_date)<=l.end_date;
        const actual=charges.filter(fits),reserved=commitments.filter(fits),scopedActual=actual.filter(inScope),scopedReserved=reserved.filter(inScope);
        return{...l,approved:decimal(l.amount),actual:decimal(sum(scopedActual.map(x=>x.amount))),commitments:decimal(sum(scopedReserved.map(x=>x.amount))),advance_reservations:decimal(sum(scopedReserved.filter(x=>x.kind==='advance'||x.is_advance).map(x=>x.amount))),available:decimal(l.amount-sum(actual.map(x=>x.amount))-sum(reserved.map(x=>x.amount))),charges:actual.map(x=>x.id),commitment_entries:reserved.map(x=>x.id)};
      });
      const sources=this.sourceBalances(project,to).filter(s=>!source||s.id===source);
      const ledger=this.all('SELECT l.*,j.kind,j.reversal_of,j.reference,j.description,j.date,a.name AS account,a.code,a.type,s.name AS source FROM journal_lines l JOIN journals j ON j.id=l.journal_id JOIN accounts a ON a.id=l.account_id JOIN funding_sources s ON s.id=l.source_id WHERE l.project_id=? AND j.date<=? ORDER BY j.date,l.id',project,to).filter(l=>!source||l.source_id===source);
      const gl=type=>sum(ledger.filter(l=>l.type===type).map(l=>l.amount));
      const isKind=(l,kind)=>l.kind===kind||(l.reversal_of&&this.get('SELECT kind FROM journals WHERE id=?',l.reversal_of)?.kind===kind);
      const advanceReserve=sum(scopedCommitments.filter(c=>c.kind==='advance'||c.is_advance).map(c=>c.amount)),poReserve=sum(scopedCommitments.filter(c=>c.is_po).map(c=>c.amount));
      const totals={approved:sum(budgetLines.map(l=>l.amount)),actual:sum(scopedCharges.map(c=>c.amount)),commitment:sum(scopedCommitments.map(c=>c.amount)),advance_reservations:advanceReserve,purchase_commitments:poReserve,other_reservations:sum(scopedCommitments.map(c=>c.amount))-advanceReserve-poReserve,available:sum(categoryRows.map(r=>parseMoney(r.available,{zero:true,signed:true}))),promised:sum(sources.map(s=>s.promised)),received:sum(sources.map(s=>s.received)),funding_outstanding:sum(sources.map(s=>s.outstanding)),funding_returned:sum(sources.map(s=>s.returned)),cash:gl('bank')+gl('cash')+gl('mobile'),liability:0-gl('payable'),advances:gl('advance'),supplier_receivables:sum(ledger.filter(l=>l.code==='1300').map(l=>l.amount)),payments:sum(ledger.filter(l=>l.type==='payable'&&isKind(l,'payment')).map(l=>l.amount))};
      const period={actual:sum(scopedCharges.filter(c=>c.posting_date>=from).map(c=>c.amount)),commitment_change:sum(scopedCommitments.filter(c=>c.effective_date>=from).map(c=>c.amount)),cash_change:sum(ledger.filter(l=>l.date>=from&&['bank','cash','mobile'].includes(l.type)).map(l=>l.amount)),payments:sum(ledger.filter(l=>l.date>=from&&l.type==='payable'&&isKind(l,'payment')).map(l=>l.amount))};
      const bills=this.all('SELECT DISTINCT b.* FROM bills b JOIN bill_lines bl ON bl.bill_id=b.id JOIN request_lines l ON l.id=bl.request_line_id WHERE l.project_id=? AND b.date<=? ORDER BY b.id',project,to).map(b=>{
        let unpaid=0;for(const l of this.billAllocations(b.id).filter(inScope).filter(l=>l.project_id===project)){
          const paid=this.get('SELECT COALESCE(SUM(pa.amount),0) AS n FROM payment_allocations pa JOIN payments p ON p.id=pa.payment_id JOIN journals j ON j.id=p.journal_id WHERE pa.bill_line_id=? AND j.date<=? AND NOT EXISTS(SELECT 1 FROM journals rev WHERE rev.reversal_of=j.id AND rev.date<=?)',l.bill_line_id,to,to).n;
          const credited=this.get('SELECT COALESCE(SUM(cl.liability_amount),0) AS n FROM credit_lines cl JOIN credit_notes c ON c.id=cl.credit_id JOIN journals j ON j.id=c.journal_id WHERE cl.bill_line_id=? AND j.date<=? AND NOT EXISTS(SELECT 1 FROM journals rev WHERE rev.reversal_of=j.id AND rev.date<=?)',l.bill_line_id,to,to).n;
          unpaid+=l.billed-paid-credited;
        }
        if(this.get('SELECT id FROM journals WHERE reversal_of=? AND date<=?',b.journal_id,to))unpaid=0;
        return{...b,unpaid:decimal(unpaid),overdue:unpaid>0&&(b.due_date||b.date)<to};
      });
      const obligations=bills.filter(b=>Number(b.unpaid)>0);totals.overdue_bills=sum(bills.filter(b=>b.overdue).map(b=>parseMoney(b.unpaid,{zero:true})));
      totals.liability=sum(bills.map(b=>parseMoney(b.unpaid,{zero:true})));
      const advances=this.advanceDetails(actor,project).filter(a=>a.date<=to).map(a=>{
        const lines=this.all('SELECT al.*,l.source_id,l.category FROM advance_lines al JOIN request_lines l ON l.id=al.request_line_id WHERE al.advance_id=? AND l.project_id=?',a.id,project).filter(inScope);
        const valid=this.get('SELECT id FROM journals WHERE reversal_of=? AND date<=?',a.journal_id,to)?0:1;
        let settled=0,returned=0;for(const l of lines)for(const m of this.all('SELECT s.*,j.date FROM settlements s JOIN journals j ON j.id=s.journal_id WHERE s.advance_id=? AND s.request_line_id=? AND j.date<=? AND NOT EXISTS(SELECT 1 FROM journals r WHERE r.reversal_of=j.id AND r.date<=?)',a.id,l.request_line_id,to,to)){if(m.kind==='settlement')settled+=m.amount;else returned+=m.amount;}
        const issued=valid*sum(lines.map(l=>l.amount)),outstanding=issued-settled-returned;return{...a,issued:decimal(issued),settled:decimal(settled),returned:decimal(returned),outstanding:decimal(outstanding),overdue:outstanding>0&&a.due_date<to,movements:a.movements.filter(m=>this.get('SELECT date FROM journals WHERE id=?',m.journal_id).date<=to)};
      });
      totals.overdue_advances=sum(advances.filter(a=>a.overdue).map(a=>parseMoney(a.outstanding,{zero:true})));
      totals.advances=sum(advances.map(a=>parseMoney(a.outstanding,{zero:true})));
      const paymentRows=this.all('SELECT pa.amount,l.category,l.source_id,j.date,CASE WHEN j.reversal_of IS NULL THEN 1 ELSE -1 END AS sign FROM payment_allocations pa JOIN payments p ON p.id=pa.payment_id JOIN bill_lines bl ON bl.id=pa.bill_line_id JOIN request_lines l ON l.id=bl.request_line_id JOIN journals j ON j.id=p.journal_id OR j.reversal_of=p.journal_id WHERE l.project_id=? AND j.date<=?',project,to).filter(inScope);
      totals.payments=sum(paymentRows.map(l=>l.sign*l.amount));period.payments=sum(paymentRows.filter(l=>l.date>=from).map(l=>l.sign*l.amount));
      const creditRows=this.all('SELECT cl.*,l.category,l.source_id FROM credit_lines cl JOIN credit_notes cr ON cr.id=cl.credit_id JOIN bill_lines bl ON bl.id=cl.bill_line_id JOIN request_lines l ON l.id=bl.request_line_id JOIN journals j ON j.id=cr.journal_id WHERE l.project_id=? AND j.date<=? AND NOT EXISTS(SELECT 1 FROM journals rev WHERE rev.reversal_of=j.id AND rev.date<=?)',project,to,to).filter(inScope);
      totals.supplier_receivables=sum(creditRows.map(cl=>cl.receivable_amount-this.get('SELECT COALESCE(SUM(rl.amount),0) AS n FROM refund_lines rl JOIN supplier_refunds r ON r.id=rl.refund_id JOIN journals j ON j.id=r.journal_id WHERE rl.credit_line_id=? AND j.date<=? AND NOT EXISTS(SELECT 1 FROM journals rev WHERE rev.reversal_of=j.id AND rev.date<=?)',cl.id,to,to).n));
      const promises=this.all('SELECT p.*,s.name AS source FROM promises p JOIN funding_sources s ON s.id=p.source_id WHERE s.project_id=? AND p.date<=?',project,to).filter(l=>!source||l.source_id===source).map(p=>({...p,amount:decimal(p.amount),adjustments:this.all('SELECT * FROM promise_adjustments WHERE promise_id=? AND date<=?',p.id,to).map(a=>({...a,amount:decimal(a.amount)}))}));
      return{project:{id:p.id,code:p.code,name:p.name,status:p.status,operational_state:p.operational_state,demo:p.demo},filters:{from,to,source_id:source,category},budget_version:budget?.version||null,notes:['Balances are cumulative through the end date; period movements are shown separately.','Category-filtered cash and funding remain project/source totals because cash has no category dimension; payments, liabilities and advances follow request allocations.','Source-filtered budget authority is shared: available category budget includes charges and reservations from every source.'],totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,decimal(v)])),period:Object.fromEntries(Object.entries(period).map(([k,v])=>[k,decimal(v)])),categories:categoryRows,sources:sources.map(s=>({...s,promised:decimal(s.promised),received:decimal(s.received),returned:decimal(s.returned),outstanding:decimal(s.outstanding),cash:decimal(s.cash)})),charges:scopedCharges.map(c=>({...c,amount:decimal(c.amount)})),commitments:scopedCommitments.map(c=>({...c,amount:decimal(c.amount)})),ledger:ledger.map(l=>({...l,amount:decimal(l.amount)})),period_ledger:ledger.filter(l=>l.date>=from).map(l=>({...l,amount:decimal(l.amount)})),bills,obligations,advances,promises};
    },
    reportCSV(actor,project,filters) {
      const r=this.report(actor,project,filters),rows=[['Project',r.project.code,r.project.name],['From',r.filters.from,'Through',r.filters.to],['Section','ID / metric','Date / period','Category / account','Source / description','Amount USD']];
      for(const [key,value]of Object.entries(r.totals))rows.push(['Closing balance',key,r.filters.to,'','',value]);
      for(const [key,value]of Object.entries(r.period))rows.push(['Period movement',key,`${r.filters.from} to ${r.filters.to}`,'','',value]);
      for(const l of r.categories)rows.push(['Approved budget',l.id,`${l.start_date} to ${l.end_date}`,`${l.category}/${l.activity}`,'Shared authority',l.approved],['Available budget',l.id,r.filters.to,`${l.category}/${l.activity}`,'All funding sources',l.available]);
      for(const l of r.charges)rows.push(['Budget charge',l.id,l.posting_date,l.category,l.reference,l.amount]);
      for(const l of r.commitments)rows.push(['Reservation movement',l.id,l.effective_date,l.category,l.reason,l.amount]);
      for(const l of r.ledger)rows.push(['Journal line',l.id,l.date,`${l.code} ${l.account}`,l.reference,l.amount]);
      for(const a of r.advances)rows.push(['Advance outstanding',a.id,a.due_date,a.beneficiary_type,a.beneficiary,a.outstanding]);
      for(const b of r.bills)rows.push(['Bill unpaid',b.id,b.due_date||b.date,b.supplier,b.invoice,b.unpaid]);
      for(const p of r.promises){rows.push(['Funding promise',p.id,p.date,'',p.reference,p.amount]);for(const a of p.adjustments)rows.push(['Promise adjustment',a.id,a.date,'',a.reason,a.amount]);}
      return exportCSV(rows);
    }
  };
}
