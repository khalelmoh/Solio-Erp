import { parseCSV } from './csv.js';

export function reconciliationMethods({fail,text,date,parseMoney,cents,decimal,sum}) {
  return {
    statementState(id) {return this.get('SELECT kind FROM statement_events WHERE statement_id=? ORDER BY id DESC LIMIT 1',id)?.kind==='finalize'?'finalized':'open';},
    createStatement(actor,d) {
      this.reconciliationRole(actor);this.cashAccount(d.account_id);const start=date(d.start_date),end=date(d.end_date);if(start>end)fail('Statement date range is invalid');
      if(this.get('SELECT id FROM statements WHERE account_id=? AND start_date<=? AND end_date>=?',d.account_id,end,start))fail('Statement range overlaps an existing import; review that statement instead',409);
      if(!Array.isArray(d.lines)||d.lines.length>1000)fail('Provide up to 1,000 statement lines');
      const opening=parseMoney(d.opening_balance,{zero:true,signed:true}),closing=parseMoney(d.closing_balance,{zero:true,signed:true});
      const lines=d.lines.map(l=>({external_id:text(l.external_id,'Unique bank transaction ID',150),date:date(l.date),description:text(l.description,'Statement description',1000),amount:parseMoney(l.amount,{signed:true})}));
      if(lines.some(l=>l.date<start||l.date>end))fail('Statement movement lies outside its date range');
      if(sum([opening,...lines.map(l=>l.amount)])!==closing)fail('Opening balance plus statement movements must equal closing balance');
      const prior=this.get('SELECT * FROM statements WHERE account_id=? AND end_date<? ORDER BY end_date DESC LIMIT 1',d.account_id,start);
      if(prior&&prior.closing_balance!==opening)fail('Opening balance does not agree with the preceding statement closing balance');
      const id=this.insert('statements',{account_id:d.account_id,reference:text(d.reference,'Statement reference'),start_date:start,end_date:end,opening_balance:opening,closing_balance:closing,actor_id:actor});
      for(const l of lines)this.insert('statement_lines',{statement_id:id,account_id:d.account_id,...l});return{id};
    },
    importStatement(actor,d) {
      let rows;try{rows=parseCSV(d.csv);}catch(e){fail(e.message);}
      const header=rows.shift();if(!header||header.map(h=>h.replace(/^\uFEFF/,'')).join(',')!=='external_id,date,description,amount')fail('CSV header must be external_id,date,description,amount');
      if(rows.some(r=>r.length!==4))fail('Each CSV row must have four fields');
      return this.createStatement(actor,{...d,lines:rows.map(([external_id,date,description,amount])=>({external_id,date,description,amount}))});
    },
    matchedStatement(id) {return this.get('SELECT COALESCE(SUM(m.amount),0) AS n FROM statement_matches m WHERE m.statement_line_id=? AND NOT EXISTS(SELECT 1 FROM match_reversals r WHERE r.match_id=m.id)',id).n;},
    matchedBook(id,finalizedOnly=false,through='9999-12-31') {
      const matches=this.all('SELECT m.amount,sl.statement_id FROM statement_matches m JOIN statement_lines sl ON sl.id=m.statement_line_id WHERE m.journal_line_id=? AND sl.date<=? AND NOT EXISTS(SELECT 1 FROM match_reversals r WHERE r.match_id=m.id)',id,through);
      return sum(matches.filter(m=>!finalizedOnly||this.statementState(m.statement_id)==='finalized').map(m=>m.amount))+(this.get('SELECT amount AS n FROM cash_offset_lines WHERE journal_line_id=?',id)?.n||0);
    },
    matchStatement(actor,d) {
      this.reconciliationRole(actor);const statementLine=this.get('SELECT * FROM statement_lines WHERE id=?',d.statement_line_id),book=this.get('SELECT l.*,j.date FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE l.id=?',d.journal_line_id);if(!statementLine||!book)fail('Choose a statement movement and posted cash line');
      const statement=this.get('SELECT * FROM statements WHERE id=?',statementLine.statement_id);if(this.statementState(statement.id)==='finalized')fail('Reopen the finalized statement before changing matches',409);
      if(book.account_id!==statement.account_id||Math.sign(book.amount)!==Math.sign(statementLine.amount)||book.date>statement.end_date)fail('Match requires the same cash account, direction and eligible cutoff');
      const amount=cents(d.amount);if(amount>Math.abs(statementLine.amount)-this.matchedStatement(statementLine.id)||amount>Math.abs(book.amount)-this.matchedBook(book.id))fail('Match exceeds the unreconciled statement or book amount',409);
      return{id:this.insert('statement_matches',{statement_line_id:statementLine.id,journal_line_id:book.id,amount,reference:text(d.reference,'Unique matching reference'),actor_id:actor})};
    },
    unmatchStatement(actor,d) {
      this.reconciliationRole(actor);const m=this.get('SELECT m.*,sl.statement_id FROM statement_matches m JOIN statement_lines sl ON sl.id=m.statement_line_id WHERE m.id=?',d.id);if(!m)fail('Unknown match');if(this.statementState(m.statement_id)==='finalized')fail('Reopen the finalized statement before unmatching');
      return{id:this.insert('match_reversals',{match_id:m.id,reason:text(d.reason,'Unmatching rationale',2000),actor_id:actor})};
    },
    statementDetails(actor,id) {
      this.reconciliationRole(actor);const s=this.get('SELECT s.*,a.name AS account FROM statements s JOIN accounts a ON a.id=s.account_id WHERE s.id=?',id);if(!s)fail('Unknown statement',404);
      const lines=this.all('SELECT * FROM statement_lines WHERE statement_id=? ORDER BY date,id',s.id).map(l=>({...l,matched:this.matchedStatement(l.id),unmatched:Math.abs(l.amount)-this.matchedStatement(l.id),matches:this.all('SELECT m.*,j.reference AS journal_reference FROM statement_matches m JOIN journal_lines jl ON jl.id=m.journal_line_id JOIN journals j ON j.id=jl.journal_id WHERE m.statement_line_id=?',l.id).map(m=>({...m,amount:decimal(m.amount),reversed:!!this.get('SELECT 1 FROM match_reversals WHERE match_id=?',m.id)}))}));
      const book=this.all('SELECT l.*,j.date,j.reference,j.description,p.code AS project FROM journal_lines l JOIN journals j ON j.id=l.journal_id LEFT JOIN projects p ON p.id=l.project_id WHERE l.account_id=? AND j.date<=? ORDER BY j.date,l.id',s.account_id,s.end_date).map(l=>({...l,matched:this.matchedBook(l.id,false,s.end_date),unmatched:Math.abs(l.amount)-this.matchedBook(l.id,false,s.end_date)}));
      const balance=sum(book.map(l=>l.amount)),outstanding=sum(book.map(l=>Math.sign(l.amount)*l.unmatched)),difference=balance-s.closing_balance-outstanding;
      return{...s,state:this.statementState(s.id),opening_balance:decimal(s.opening_balance),closing_balance:decimal(s.closing_balance),book_balance:decimal(balance),outstanding_book:decimal(outstanding),difference:decimal(difference),lines:lines.map(l=>({...l,amount:decimal(l.amount),matched:decimal(l.matched),unmatched:decimal(l.unmatched)})),book:book.map(l=>({...l,amount:decimal(l.amount),matched:decimal(l.matched),unmatched:decimal(l.unmatched)})),events:this.all('SELECT * FROM statement_events WHERE statement_id=? ORDER BY id',s.id)};
    },
    finalizeStatement(actor,d) {
      this.reconciliationRole(actor);const details=this.statementDetails(actor,d.id);if(details.state==='finalized')fail('Statement is already finalized',409);
      if(details.lines.some(l=>Number(l.unmatched)>0))fail('Match all statement movements before finalizing',409);if(details.difference!=='0.00')fail(`Reconciliation difference is ${details.difference}; investigate before finalizing`,409);
      const outstanding=details.book.filter(l=>Number(l.unmatched)>0),reviews=d.reviews||[];if(!Array.isArray(reviews)||reviews.length!==outstanding.length||new Set(reviews.map(r=>r.journal_line_id)).size!==reviews.length)fail('Review and explain every outstanding book movement');
      for(const l of outstanding){const review=reviews.find(r=>r.journal_line_id===l.id);if(!review)fail('Outstanding item review is missing');text(review.reason,'Outstanding item review',2000);}
      const watermark=this.get('SELECT COALESCE(MAX(id),0) AS n FROM journal_lines WHERE account_id=?',details.account_id).n;
      const event=this.insert('statement_events',{statement_id:details.id,kind:'finalize',reason:text(d.reason||'Statement matched and outstanding items reviewed','Finalization reason',2000),actor_id:actor,line_watermark:watermark});
      for(const l of outstanding)this.insert('statement_reviews',{event_id:event,journal_line_id:l.id,amount:parseMoney(l.unmatched),reason:reviews.find(r=>r.journal_line_id===l.id).reason});return{id:details.id,event_id:event};
    },
    reopenStatement(actor,d) {
      this.reconciliationRole(actor);const s=this.get('SELECT * FROM statements WHERE id=?',d.id);if(!s||this.statementState(s.id)!=='finalized')fail('Only a finalized statement can be reopened');
      return{id:this.insert('statement_events',{statement_id:s.id,kind:'reopen',reason:text(d.reason,'Authorized statement reopening reason',2000),actor_id:actor,line_watermark:0})};
    },
    offsetCash(actor,d) {
      this.reconciliationRole(actor);if(!Array.isArray(d.line_ids)||d.line_ids.length!==2||d.line_ids[0]===d.line_ids[1])fail('Select two linked opposite cash correction lines');
      const rows=d.line_ids.map(id=>this.get('SELECT l.*,j.reversal_of FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE l.id=?',id));if(rows.some(r=>!r))fail('Unknown cash line');const [a,b]=rows;this.cashAccount(a.account_id);
      if(a.account_id!==b.account_id||a.project_id!==b.project_id||a.source_id!==b.source_id||a.amount+b.amount!==0||!(a.reversal_of===b.journal_id||b.reversal_of===a.journal_id)||this.matchedBook(a.id)||this.matchedBook(b.id))fail('Offset requires unreconciled linked reversals in the same account/project/source');
      const id=this.insert('cash_offsets',{reason:text(d.reason,'Reason these book corrections did not move bank cash',2000),actor_id:actor});for(const l of rows)this.insert('cash_offset_lines',{journal_line_id:l.id,offset_id:id,amount:Math.abs(l.amount)});return{id};
    },
    reconciliationOverview(actor) {
      this.reconciliationRole(actor);return{statements:this.all('SELECT id FROM statements ORDER BY end_date DESC,id DESC').map(s=>this.statementDetails(actor,s.id)),accounts:this.all("SELECT * FROM accounts WHERE type IN('bank','cash','mobile')"),offsets:this.all('SELECT * FROM cash_offsets ORDER BY id DESC')};
    }
  };
}
