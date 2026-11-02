export function lifecycleMethods({base,fail,text,date,parseMoney,cents,decimal,sum,today,split,hash,canonical}) {
  const activeJournal = 'NOT EXISTS(SELECT 1 FROM journals rev WHERE rev.reversal_of=j.id)';
  return {
    spendable(actor,id,roles) { const p=this.active(actor,id,roles);if(p.operational_state!=='open')fail('Project is operationally complete; reopen before requesting new spending',409);return p; },
    submitBudget(actor,d) {
      const result=base.submitBudget.call(this,actor,d);
      this.insert('budget_changes',{budget_id:result.id,kind:d.change_kind||'version',details:JSON.stringify(d.change_details||{})});
      this.saveDocuments(actor,'budget',result.id,[d.project_id],d.documents);
      return result;
    },
    amendBudget(actor,d) {
      this.active(actor,d.project_id,['manager','finance']);const prior=this.currentBudget(d.project_id);if(!prior)fail('An amendment requires an approved budget');
      if(!['increase','reduction','reallocation'].includes(d.change_kind))fail('Specify increase, reduction or reallocation');
      if(!Array.isArray(d.lines))fail('Provide a complete replacement budget');
      const old=this.get('SELECT SUM(amount) AS n FROM budget_lines WHERE budget_id=?',prior.id).n,newTotal=sum(d.lines.map(l=>cents(l.amount)));
      if((d.change_kind==='increase'&&newTotal<=old)||(d.change_kind==='reduction'&&newTotal>=old)||(d.change_kind==='reallocation'&&newTotal!==old))fail('Budget total does not agree with the selected amendment type');
      return this.submitBudget(actor,{...d,change_details:{previous_budget:prior.id,change:decimal(newTotal-old)}});
    },
    transferBudget(actor,d) {
      this.active(actor,d.project_id,['manager','finance']);const prior=this.currentBudget(d.project_id);if(!prior)fail('A transfer requires an approved budget');
      const lines=this.all('SELECT * FROM budget_lines WHERE budget_id=?',prior.id),from=lines.find(l=>l.id===d.from_line_id),to=lines.find(l=>l.id===d.to_line_id),amount=cents(d.amount);
      if(!from||!to||from.id===to.id||from.category===to.category)fail('Choose two different approved budget categories');
      if(amount>from.amount)fail('Transfer exceeds the source category budget');
      return this.submitBudget(actor,{project_id:d.project_id,reason:d.reason,documents:d.documents,change_kind:'transfer',change_details:{from_line_id:from.id,to_line_id:to.id,amount:decimal(amount)},lines:lines.map(l=>({...l,amount:l.amount+(l.id===from.id?-amount:l.id===to.id?amount:0)})).filter(l=>l.amount>0).map(l=>({...l,amount:decimal(l.amount)}))});
    },
    saveDocuments(actor,kind,id,projects,documents=[]) {
      if(!Array.isArray(documents)||documents.length>4)fail('At most four supporting files are allowed per operation');
      for(const doc of documents) {
        const filename=text(doc.filename,'Filename',160);if(/[\\/\r\n\x00-\x1f]/.test(filename))fail('Invalid filename');
        if(!['application/pdf','image/png','image/jpeg','text/plain'].includes(doc.mime))fail('Only PDF, PNG, JPEG and plain text evidence is supported');
        if(typeof doc.content!=='string'||!doc.content.length||doc.content.length>699052||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(doc.content))fail('File content must be bounded base64');
        const bytes=Buffer.from(doc.content,'base64');if(!bytes.length||bytes.length>524288)fail('Files must be 1 byte to 512 KiB');
        if(doc.mime==='application/pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))fail('Invalid PDF file');
        if(doc.mime==='image/png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail('Invalid PNG file');
        if(doc.mime==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))fail('Invalid JPEG file');
        if(doc.mime==='text/plain'&&bytes.includes(0))fail('Plain text file contains binary content');
        this.insert('documents',{kind,entity_id:id,projects:JSON.stringify([...new Set(projects)]),filename,mime:doc.mime,bytes:bytes.length,sha256:hash(bytes),content:bytes,actor_id:actor});
      }
    },
    documents(kind,id,actor=null) {
      return this.all('SELECT id,filename,mime,bytes,sha256,actor_id,created_at,projects FROM documents WHERE kind=? AND entity_id=? ORDER BY id',kind,id).filter(doc=>actor===null||JSON.parse(doc.projects).every(p=>this.get('SELECT 1 FROM memberships WHERE project_id=? AND user_id=?',p,actor))).map(({projects,...doc})=>doc);
    },
    document(actor,id) {const doc=this.get('SELECT * FROM documents WHERE id=?',id);if(!doc)fail('Unknown document',404);for(const p of JSON.parse(doc.projects))this.project(actor,p);return doc;},
    addDocument(actor,d) {
      let projects;
      if(d.kind==='budget'){const b=this.get('SELECT * FROM budget_versions WHERE id=?',d.id);if(!b||b.state!=='submitted')fail('Supporting documents may be added only before approval');this.active(actor,b.project_id,['manager','finance']);projects=[b.project_id];}
      else if(d.kind==='request'){const r=this.request(actor,d.id,['requester','manager','finance']);if(r.state!=='submitted'||r.creator_id!==actor)fail('Only the creator may add request evidence before approval',403);projects=r.lines.map(l=>l.project_id);}
      else fail('Attach supporting evidence with the original posting operation');
      if(this.get('SELECT id FROM approvals WHERE kind=? AND document_id=?',d.kind==='request'?'spending':'budget',d.id))fail('A partially approved document needs a new version to change evidence');
      this.saveDocuments(actor,d.kind,d.id,projects,d.documents);return{id:d.id};
    },
    submitRequest(actor,d) {
      if(!['purchase','advance'].includes(d.kind||'purchase'))fail('Unknown request kind');
      let terms;
      if(d.kind==='advance') {
        if(!['employee','supplier'].includes(d.beneficiary_type))fail('Specify employee or supplier beneficiary');
        terms={beneficiary:text(d.beneficiary,'Responsible person or supplier'),beneficiary_type:d.beneficiary_type,due_date:date(d.due_date)};if(terms.due_date<date(d.date))fail('Advance due date precedes request');
      }
      const result=base.submitRequest.call(this,actor,d);
      if(terms)this.insert('advance_requests',{request_id:result.id,...terms});
      this.saveDocuments(actor,'request',result.id,d.lines.map(l=>l.project_id),d.documents);return result;
    },
    editRequest(actor,d) {
      const old=this.request(actor,d.id),terms=this.get('SELECT * FROM advance_requests WHERE request_id=?',old.id);
      return base.editRequest.call(this,actor,{...terms,...d,kind:d.kind||old.kind});
    },
    approveRequest(actor,d) {const r=this.request(actor,d.id,['manager','finance']);for(const l of r.lines)this.spendable(actor,l.project_id);return base.approveRequest.call(this,actor,d);},
    createPO(actor,d) {const r=this.request(actor,d.request_id,['manager','finance']);for(const l of r.lines)this.spendable(actor,l.project_id);if(r.kind==='advance')fail('An advance request cannot create a purchase order');return base.createPO.call(this,actor,d);},
    postBill(actor,d) {
      const due=date(d.due_date||d.date);if(due<date(d.date))fail('Bill due date precedes invoice date');
      const result=base.postBill.call(this,actor,{...d,due_date:due});
      const projects=this.all('SELECT DISTINCT l.project_id FROM bill_lines b JOIN request_lines l ON l.id=b.request_line_id WHERE b.bill_id=?',result.id).map(l=>l.project_id);
      this.saveDocuments(actor,'bill',result.id,projects,d.documents);return result;
    },
    issueAdvance(actor,d) {
      const r=this.request(actor,d.request_id,['finance']);for(const l of r.lines)this.spendable(actor,l.project_id);
      const requested=this.get('SELECT * FROM advance_requests WHERE request_id=?',r.id);
      const due=date(requested?.due_date||d.due_date||this.get('SELECT end_date FROM projects WHERE id=?',r.lines[0].project_id).end_date);
      const type=requested?.beneficiary_type||d.beneficiary_type||'employee';if(!['employee','supplier'].includes(type))fail('Invalid beneficiary type');
      if(due<date(d.date))fail('Advance due date precedes disbursement');
      const result=base.issueAdvance.call(this,actor,{...d,beneficiary:requested?.beneficiary||d.beneficiary});
      this.insert('advance_terms',{advance_id:result.id,beneficiary_type:type,due_date:due});this.saveDocuments(actor,'advance',result.id,r.lines.map(l=>l.project_id),d.documents);return result;
    },
    advanceMovement(actor,d,kind) {
      const advance=this.get('SELECT * FROM advances WHERE id=?',d.advance_id);if(!advance)fail('Unknown advance');if(this.reversed(advance.journal_id))fail('Advance disbursement has been reversed');
      const modern=this.get('SELECT * FROM advance_requests WHERE request_id=?',advance.request_id);
      if(kind==='settlement'&&modern&&(!Array.isArray(d.documents)||!d.documents.length))fail('Supporting receipts are required for accepted advance expenditure');
      if(d.cost_type&&!['expense','asset'].includes(d.cost_type))fail('Invalid cost classification');
      const result=base.advanceMovement.call(this,actor,d,kind);
      if(kind==='return'){const release=Math.min(cents(d.amount),Math.max(0,this.balance(d.request_line_id)));if(release)this.insert('commitments',{request_line_id:d.request_line_id,amount:-release,journal_id:result.journal_id,reason:'Unused advance return releases reservation'});}
      const project=this.get('SELECT project_id FROM request_lines WHERE id=?',d.request_line_id).project_id;this.saveDocuments(actor,'settlement',result.id,[project],d.documents);return result;
    },
    advanceOutstanding(request) {
      const a=this.get('SELECT * FROM advances WHERE request_id=?',request);if(!a||this.reversed(a.journal_id))return 0;
      return this.get('SELECT COALESCE(SUM(amount),0) AS n FROM advance_lines WHERE advance_id=?',a.id).n-this.get(`SELECT COALESCE(SUM(s.amount),0) AS n FROM settlements s JOIN journals j ON j.id=s.journal_id WHERE s.advance_id=? AND ${activeJournal}`,a.id).n;
    },
    advanceDetails(actor,project) {
      return this.all('SELECT DISTINCT a.*,t.due_date,t.beneficiary_type,j.date FROM advances a JOIN advance_lines al ON al.advance_id=a.id JOIN request_lines l ON l.id=al.request_line_id JOIN journals j ON j.id=a.journal_id LEFT JOIN advance_terms t ON t.advance_id=a.id WHERE l.project_id=? ORDER BY a.id DESC',project).map(a=>{
        const lines=this.all('SELECT al.*,l.category,l.activity,l.source_id FROM advance_lines al JOIN request_lines l ON l.id=al.request_line_id WHERE al.advance_id=? AND l.project_id=?',a.id,project).map(l=>{
          const settled=this.get(`SELECT COALESCE(SUM(s.amount),0) AS n FROM settlements s JOIN journals j ON j.id=s.journal_id WHERE s.advance_id=? AND s.request_line_id=? AND s.kind='settlement' AND ${activeJournal}`,a.id,l.request_line_id).n;
          const returned=this.get(`SELECT COALESCE(SUM(s.amount),0) AS n FROM settlements s JOIN journals j ON j.id=s.journal_id WHERE s.advance_id=? AND s.request_line_id=? AND s.kind='return' AND ${activeJournal}`,a.id,l.request_line_id).n;
          return{...l,issued:l.amount,settled,returned,outstanding:this.reversed(a.journal_id)?0:l.amount-settled-returned};
        });
        const movements=this.all('SELECT s.*,j.date,l.category FROM settlements s JOIN journals j ON j.id=s.journal_id JOIN request_lines l ON l.id=s.request_line_id WHERE s.advance_id=? AND l.project_id=? ORDER BY s.id',a.id,project).map(s=>({...s,amount:decimal(s.amount),reversed:this.reversed(s.journal_id),documents:this.documents('settlement',s.id,actor)}));
        const due=a.due_date||this.get('SELECT end_date FROM projects WHERE id=?',project).end_date,outstanding=sum(lines.map(l=>l.outstanding));
        return{...a,due_date:due,legacy_due:!a.due_date,beneficiary_type:a.beneficiary_type||'employee',issued:decimal(sum(lines.map(l=>l.issued))),settled:decimal(sum(lines.map(l=>l.settled))),returned:decimal(sum(lines.map(l=>l.returned))),outstanding:decimal(outstanding),overdue:outstanding>0&&due<today(),reversed:this.reversed(a.journal_id),lines:lines.map(l=>({...l,amount:decimal(l.amount),issued:decimal(l.issued),settled:decimal(l.settled),returned:decimal(l.returned),outstanding:decimal(l.outstanding),reserved:decimal(this.balance(l.request_line_id))})),movements,documents:this.documents('advance',a.id,actor)};
      });
    },
    billAllocations(id) {
      return this.all('SELECT l.*,bl.id AS bill_line_id,bl.amount AS billed FROM bill_lines bl JOIN request_lines l ON l.id=bl.request_line_id WHERE bl.bill_id=? ORDER BY bl.id',id).map(l=>{
        const paid=this.get(`SELECT COALESCE(SUM(pa.amount),0) AS n FROM payment_allocations pa JOIN payments p ON p.id=pa.payment_id JOIN journals j ON j.id=p.journal_id WHERE pa.bill_line_id=? AND ${activeJournal}`,l.bill_line_id).n;
        const credit=this.get(`SELECT COALESCE(SUM(cl.liability_amount),0) AS n FROM credit_lines cl JOIN credit_notes c ON c.id=cl.credit_id JOIN journals j ON j.id=c.journal_id WHERE cl.bill_line_id=? AND ${activeJournal}`,l.bill_line_id).n;
        const credited=this.get(`SELECT COALESCE(SUM(cl.amount),0) AS n FROM credit_lines cl JOIN credit_notes c ON c.id=cl.credit_id JOIN journals j ON j.id=c.journal_id WHERE cl.bill_line_id=? AND ${activeJournal}`,l.bill_line_id).n;
        return{...l,paid,credited,unpaid:l.billed-paid-credit};
      });
    },
    unpaid(bill) {if(this.reversed(bill.journal_id))return 0;return sum(this.billAllocations(bill.id).map(l=>Math.max(0,l.unpaid)));},
    projectUnpaid(bill,project) {if(this.reversed(bill.journal_id))return 0;return sum(this.billAllocations(bill.id).filter(l=>l.project_id===project).map(l=>Math.max(0,l.unpaid)));},
    correctionCheck(actor,original,d,newJournal=null) {
      const locked=this.get("SELECT id FROM periods WHERE state='closed' AND start_date<=? AND end_date>=?",original.date,original.date);
      if(!locked)return;
      const auth=this.get('SELECT * FROM correction_authorizations WHERE id=?',d.authorization_id||0);
      if(!auth||auth.journal_id!==original.id||auth.poster_id!==actor||auth.actor_id===actor||auth.expiry<today()||this.get('SELECT 1 FROM correction_uses WHERE authorization_id=?',auth.id))fail('Locked-period correction requires an unused independent authorization for this journal and poster',403);
      if(newJournal)this.insert('correction_uses',{authorization_id:auth.id,journal_id:newJournal});
    },
    authorizeCorrection(actor,d) {
      this.admin(actor);const journal=this.get("SELECT * FROM journals WHERE id=? AND state='posted'",d.journal_id);if(!journal)fail('Unknown posted journal');
      this.user(d.poster_id);if(actor===d.poster_id)fail('Correction authorization must be independent of the poster',403);
      for(const p of this.all('SELECT DISTINCT project_id FROM journal_lines WHERE journal_id=?',journal.id))this.active(d.poster_id,p.project_id,['finance']);
      if(date(d.expiry)<today())fail('Authorization expiry is in the past');
      return{id:this.insert('correction_authorizations',{journal_id:journal.id,poster_id:d.poster_id,actor_id:actor,expiry:d.expiry,reason:text(d.reason,'Correction authority rationale',2000)})};
    },
    setPeriod(actor,d) {
      if(d.id&&d.state==='open'&&this.get('SELECT state FROM periods WHERE id=?',d.id)?.state==='closed')fail('Locked periods cannot be reopened; post an authorized correction in an open period',403);
      return base.setPeriod.call(this,actor,d);
    },
    postCredit(actor,d) {
      const bill=this.get('SELECT * FROM bills WHERE id=?',d.bill_id);if(!bill||this.reversed(bill.journal_id))fail('Credit requires an unreversed bill');
      const po=this.get('SELECT * FROM purchase_orders WHERE id=?',bill.po_id),r=this.request(actor,po.request_id,['finance']);const dt=this.postingDate(d.date);if(dt<bill.date)fail('Credit date precedes bill');
      this.correctionCheck(actor,this.get('SELECT * FROM journals WHERE id=?',bill.journal_id),d);
      if(!Array.isArray(d.lines)||!d.lines.length||new Set(d.lines.map(l=>l.bill_line_id)).size!==d.lines.length)fail('Provide unique credited invoice lines');
      const allocations=this.billAllocations(bill.id),receivable=this.get("SELECT id FROM accounts WHERE code='1300'").id;
      const lines=d.lines.map(item=>{
        const l=allocations.find(l=>l.bill_line_id===item.bill_line_id);if(!l)fail('Unknown invoice allocation');const amount=cents(item.amount);if(amount>l.billed-l.credited)fail('Credit exceeds remaining original billed cost',409);
        if(d.restore_commitment&&r.state!=='approved')fail('Cannot restore commitment on a cancelled request');
        const liability=Math.min(amount,Math.max(0,l.unpaid));
        const cost=this.get("SELECT jl.account_id FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.journal_id=? AND jl.project_id=? AND jl.source_id=? AND a.type IN('expense','asset') AND a.code<>'1300' LIMIT 1",bill.journal_id,l.project_id,l.source_id).account_id;
        return{...l,credit:amount,liability,receivable:amount-liability,cost};
      });
      const journal=this.journal(actor,{kind:'credit',reference:`credit:${text(d.reference,'Credit reference')}`,date:dt,description:text(d.reason,'Credit note reason',2000),lines:lines.flatMap(l=>[{project_id:l.project_id,source_id:l.source_id,account_id:this.gl('payable'),amount:l.liability},{project_id:l.project_id,source_id:l.source_id,account_id:receivable,amount:l.receivable},{project_id:l.project_id,source_id:l.source_id,account_id:l.cost,amount:-l.credit}]).filter(l=>l.amount)});
      const id=this.insert('credit_notes',{bill_id:bill.id,reference:d.reference,journal_id:journal,date:dt,reason:d.reason});
      for(const l of lines) {
        this.insert('credit_lines',{credit_id:id,bill_line_id:l.bill_line_id,amount:l.credit,liability_amount:l.liability,receivable_amount:l.receivable,restore_commitment:d.restore_commitment?1:0});
        this.insert('budget_charges',{request_line_id:l.id,amount:-l.credit,journal_id:journal,date:bill.date});
        if(d.restore_commitment)this.insert('commitments',{request_line_id:l.id,amount:l.credit,journal_id:journal,reason:'Credit note: replacement goods remain committed'});
      }
      if(d.restore_commitment)for(const p of new Set(lines.map(l=>l.project_id)))this.checkBudget(p);
      this.correctionCheck(actor,this.get('SELECT * FROM journals WHERE id=?',bill.journal_id),d,journal);this.saveDocuments(actor,'credit',id,r.lines.map(l=>l.project_id),d.documents);return{id,journal_id:journal};
    },
    refundAllocations(credit) {
      if(this.reversed(credit.journal_id))return[];
      return this.all('SELECT cl.*,l.project_id,l.source_id FROM credit_lines cl JOIN bill_lines bl ON bl.id=cl.bill_line_id JOIN request_lines l ON l.id=bl.request_line_id WHERE cl.credit_id=? ORDER BY cl.id',credit.id).map(l=>({...l,outstanding:l.receivable_amount-this.get(`SELECT COALESCE(SUM(rl.amount),0) AS n FROM refund_lines rl JOIN supplier_refunds r ON r.id=rl.refund_id JOIN journals j ON j.id=r.journal_id WHERE rl.credit_line_id=? AND ${activeJournal}`,l.id).n}));
    },
    refundSupplier(actor,d) {
      const credit=this.get('SELECT * FROM credit_notes WHERE id=?',d.credit_id);if(!credit)fail('Unknown credit note');const allocations=this.refundAllocations(credit).filter(l=>l.outstanding>0),amount=cents(d.amount),dt=this.postingDate(d.date);
      if(dt<credit.date)fail('Refund date precedes credit');if(amount>sum(allocations.map(l=>l.outstanding)))fail('Refund exceeds outstanding supplier credit',409);this.cashAccount(d.account_id);
      for(const l of allocations)this.active(actor,l.project_id,['finance']);
      const weights=split(amount,allocations.map(l=>l.outstanding)),rows=allocations.map((l,i)=>({...l,refund:weights[i]})).filter(l=>l.refund);
      const journal=this.journal(actor,{kind:'supplier_refund',reference:`refund:${d.account_id}:${text(d.reference,'Refund reference')}`,date:dt,description:`Supplier refund: ${credit.reference}`,lines:rows.flatMap(l=>this.pair(l.project_id,l.source_id,d.account_id,this.get("SELECT id FROM accounts WHERE code='1300'").id,l.refund))});
      const id=this.insert('supplier_refunds',{credit_id:credit.id,account_id:d.account_id,reference:d.reference,journal_id:journal,amount});for(const l of rows)this.insert('refund_lines',{refund_id:id,credit_line_id:l.id,amount:l.refund});
      this.saveDocuments(actor,'refund',id,rows.map(l=>l.project_id),d.documents);return{id,journal_id:journal};
    },
    returnFunding(actor,d) {
      const source=this.get('SELECT * FROM funding_sources WHERE id=?',d.source_id);if(!source)fail('Unknown funding source');this.active(actor,source.project_id,['finance']);this.cashAccount(d.account_id);const amount=cents(d.amount);
      this.sufficientCash([{project_id:source.project_id,source_id:source.id,amount}],d.account_id);
      const id=this.journal(actor,{kind:'funding_return',reference:d.reference,date:this.postingDate(d.date),description:text(d.reason,'Donor/organization return reason',2000),lines:this.pair(source.project_id,source.id,this.gl('funding'),d.account_id,amount)});this.saveDocuments(actor,'journal',id,[source.project_id],d.documents);return{id};
    },
    cancelPromise(actor,d) {
      const promise=this.get('SELECT * FROM promises WHERE id=?',d.id);if(!promise)fail('Unknown funding promise');const source=this.get('SELECT * FROM funding_sources WHERE id=?',promise.source_id);this.active(actor,source.project_id,['finance']);
      const remaining=promise.amount+this.get('SELECT COALESCE(SUM(amount),0) AS n FROM promise_adjustments WHERE promise_id=?',promise.id).n,amount=cents(d.amount);if(amount>remaining)fail('Cancellation exceeds remaining promise');
      return{id:this.insert('promise_adjustments',{promise_id:promise.id,amount:-amount,reference:text(d.reference,'Promise adjustment reference'),date:date(d.date),reason:text(d.reason,'Funding promise cancellation reason',2000)})};
    },
    reverse(actor,d) {
      const original=this.get("SELECT * FROM journals WHERE id=? AND state='posted'",d.id);if(!original)fail('Unknown posted journal');this.correctionCheck(actor,original,d);
      if(original.kind==='bill'&&this.get(`SELECT c.id FROM credit_notes c JOIN journals j ON j.id=c.journal_id WHERE c.bill_id=(SELECT id FROM bills WHERE journal_id=?) AND ${activeJournal}`,original.id))fail('Reverse linked credits and refunds before the bill');
      if(original.kind==='payment'&&this.get(`SELECT c.id FROM credit_notes c JOIN journals j ON j.id=c.journal_id WHERE c.bill_id=(SELECT bill_id FROM payments WHERE journal_id=?) AND ${activeJournal}`,original.id))fail('Reverse linked credits/refunds before correcting payment allocations');
      if(!['advance','settlement','return','credit','supplier_refund'].includes(original.kind)) {
        const result=base.reverse.call(this,actor,d);this.correctionCheck(actor,original,d,result.id);this.saveDocuments(actor,'journal',result.id,this.all('SELECT DISTINCT project_id FROM journal_lines WHERE journal_id=?',result.id).map(l=>l.project_id),d.documents);return result;
      }
      if(original.reversal_of||this.reversed(original.id))fail('Journal already reversed or is itself a reversal',409);
      if(original.kind==='advance'){const a=this.get('SELECT * FROM advances WHERE journal_id=?',original.id);if(this.get(`SELECT s.id FROM settlements s JOIN journals j ON j.id=s.journal_id WHERE s.advance_id=? AND ${activeJournal}`,a.id))fail('Reverse settlements and returns before the advance issue');}
      if(original.kind==='credit'){
        const c=this.get('SELECT * FROM credit_notes WHERE journal_id=?',original.id);if(this.get(`SELECT r.id FROM supplier_refunds r JOIN journals j ON j.id=r.journal_id WHERE r.credit_id=? AND ${activeJournal}`,c.id))fail('Reverse refunds before the credit note');
        for(const l of this.all('SELECT cl.*,bl.request_line_id FROM credit_lines cl JOIN bill_lines bl ON bl.id=cl.bill_line_id WHERE cl.credit_id=?',c.id))if(l.restore_commitment&&this.balance(l.request_line_id)<l.amount)fail('Restored credit commitment was consumed or cancelled; resolve dependent spending first');
      }
      const lines=this.all('SELECT * FROM journal_lines WHERE journal_id=?',original.id);for(const l of lines)this.active(actor,l.project_id,['finance']);
      const dt=this.postingDate(d.date);if(dt<original.date)fail('Reversal date precedes original');
      const credits=lines.filter(l=>l.amount>0&&['bank','cash','mobile'].includes(this.get('SELECT type FROM accounts WHERE id=?',l.account_id).type));for(const account of new Set(credits.map(l=>l.account_id)))this.sufficientCash(credits.filter(l=>l.account_id===account),account);
      const id=this.journal(actor,{kind:'reversal',reference:d.reference,date:dt,description:text(d.reason,'Reversal rationale',2000),reversal_of:original.id,lines:lines.map(l=>({project_id:l.project_id,source_id:l.source_id,account_id:l.account_id,amount:-l.amount}))});
      for(const c of this.all('SELECT * FROM budget_charges WHERE journal_id=?',original.id))this.insert('budget_charges',{request_line_id:c.request_line_id,amount:-c.amount,journal_id:id,date:c.date});
      for(const c of this.all('SELECT c.*,r.state AS request_state FROM commitments c JOIN request_lines l ON l.id=c.request_line_id JOIN requests r ON r.id=l.request_id WHERE c.journal_id=?',original.id)){if(c.request_state==='cancelled')continue;this.insert('commitments',{request_line_id:c.request_line_id,amount:-c.amount,journal_id:id,reason:'Linked lifecycle correction'});}
      for(const p of new Set(lines.map(l=>l.project_id)))if(this.currentBudget(p))this.checkBudget(p);
      this.correctionCheck(actor,original,d,id);this.saveDocuments(actor,'journal',id,lines.map(l=>l.project_id),d.documents);return{id};
    },
    completeProject(actor,d) {
      const p=this.active(actor,d.id,['manager']);if(p.operational_state==='completed')fail('Project already operationally complete',409);
      const reason=text(d.reason,'Operational completion reason',2000);this.run("UPDATE projects SET operational_state='completed' WHERE id=?",p.id);this.insert('project_events',{project_id:p.id,kind:'operational_completion',reason,actor_id:actor});return{id:p.id};
    },
    reopenProject(actor,d) {
      this.admin(actor);const p=this.get('SELECT * FROM projects WHERE id=?',d.id);if(!p)fail('Unknown project');if(p.status==='active'&&p.operational_state==='open')fail('Project is already open');
      const reason=text(d.reason,'Authorized reopening rationale',2000);this.run("UPDATE projects SET status='active',operational_state='open' WHERE id=?",p.id);this.insert('project_events',{project_id:p.id,kind:'authorized_reopening',reason,actor_id:actor});return{id:p.id};
    },
    authorizeClosure(actor,d) {
      this.admin(actor);if(actor===d.closer_id)fail('Closure exception must be independent of the closer',403);this.active(d.closer_id,d.project_id,['manager']);
      const checklist=this.closeout(d.project_id);if(!checklist.blockers.length)fail('No unresolved balances require an exception');
      if(!Array.isArray(d.treatments)||d.treatments.length!==checklist.blockers.length)fail('Document a treatment and owner for every unresolved item');
      const unique=new Set();for(const treatment of d.treatments){const b=checklist.blockers.find(b=>b.key===treatment.key);if(!b||unique.has(b.key)||parseMoney(treatment.amount,{zero:true,signed:true})!==b.amount)fail('Treatment amounts must match the current checklist');unique.add(b.key);text(treatment.treatment,'Explicit balance treatment',2000);this.user(treatment.owner_id);}
      if(date(d.expiry)<today())fail('Closure authority has expired');
      const id=this.insert('closure_authorizations',{project_id:d.project_id,closer_id:d.closer_id,actor_id:actor,expiry:d.expiry,reason:text(d.reason,'Closeout exception justification',2000),fingerprint:hash(canonical(checklist.blockers)),treatments:JSON.stringify(d.treatments)});this.saveDocuments(actor,'closure',id,[d.project_id],d.documents);return{id};
    },
    closeProject(actor,d) {
      const p=this.active(actor,d.id,['manager']),checklist=this.closeout(p.id);let auth;
      if(checklist.blockers.length){auth=this.get('SELECT * FROM closure_authorizations WHERE id=?',d.authorization_id||0);if(!auth||auth.project_id!==p.id||auth.closer_id!==actor||auth.actor_id===actor||auth.expiry<today()||auth.fingerprint!==hash(canonical(checklist.blockers))||this.get('SELECT 1 FROM closure_uses WHERE authorization_id=?',auth.id))fail('Financial close requires zero commitments, liabilities, advances, residual funding and current reconciliation, or a valid independent closeout exception',409);}
      if(p.operational_state!=='completed')fail('Record operational completion before financial closure',409);
      const reason=text(d.reason||'Financial checklist verified','Financial closure rationale',2000),event=this.insert('project_events',{project_id:p.id,kind:'financial_closure',reason,actor_id:actor});if(auth)this.insert('closure_uses',{authorization_id:auth.id,event_id:event});
      this.run("UPDATE projects SET status='closed' WHERE id=?",p.id);return{id:p.id,exception_authorization:auth?.id||null};
    }
  };
}
