// Project summaries use one set of ledger aggregates for the bounded page.
// Detailed records and full financial exports keep their own authorized routes.
export function projectListMethods({base,fail,decimal,sum}){
  function integer(value,fallback,min,max,label){if(value===undefined)return fallback;const s=String(value);if(!/^\d+$/.test(s)||!Number.isSafeInteger(Number(s))||Number(s)<min||Number(s)>max)fail(label+' out of range');return Number(s);}
  return {
    config(actor){const result=base.config.call(this,actor);result.project_roles=this.all('SELECT DISTINCT role FROM memberships WHERE user_id=?',actor).map(r=>r.role);return result;},
    projectPage(actor,options={}){
      this.user(actor);
      const page=integer(options.page,1,1,1000000,'Page'),pageSize=integer(options.page_size,20,1,50,'Page size');
      const q=options.q??'',status=options.status??'all';if(typeof q!=='string'||q.length>100)fail('Project search must be at most 100 characters');if(!['all','active','closed'].includes(status))fail('Choose all, active or closed projects');
      const where="m.user_id=? AND (?='all' OR p.status=?) AND (?='' OR instr(lower(p.code||' '||p.name||' '||p.department),lower(?))>0)",args=[actor,status,status,q.trim(),q.trim()];
      const total=this.get('SELECT COUNT(*) AS n FROM projects p JOIN memberships m ON m.project_id=p.id WHERE '+where,...args).n;
      const rows=this.all('SELECT p.*,m.role FROM projects p JOIN memberships m ON m.project_id=p.id WHERE '+where+' ORDER BY p.id LIMIT ? OFFSET ?',...args,pageSize,(page-1)*pageSize);
      const metrics=this.projectListMetrics(rows.map(p=>p.id));
      return {projects:rows.map(p=>({...p,activities:JSON.parse(p.activities),metrics:metrics.get(p.id)})),pagination:{page,page_size:pageSize,total,total_pages:Math.ceil(total/pageSize),has_previous:page>1,has_next:page*pageSize<total},filters:{q:q.trim(),status}};
    },
    listProjects(actor,options={}){return this.projectPage(actor,options).projects;},
    projectListMetrics(ids){
      if(!ids.length)return new Map();if(ids.length>50)fail('Project metric page is too large');
      const rows=this.all(`WITH selected(id) AS (VALUES ${ids.map(()=>'(?)').join(',')}),
        budgets AS (SELECT b.project_id,SUM(l.amount) AS approved FROM selected s JOIN budget_versions b ON b.project_id=s.id JOIN budget_lines l ON l.budget_id=b.id WHERE b.state='approved' AND b.id=(SELECT v.id FROM budget_versions v WHERE v.project_id=b.project_id AND v.state='approved' ORDER BY v.version DESC LIMIT 1) GROUP BY b.project_id),
        charges AS (SELECT l.project_id,SUM(c.amount) AS actual FROM selected s JOIN request_lines l ON l.project_id=s.id JOIN budget_charges c ON c.request_line_id=l.id GROUP BY l.project_id),
        reservations AS (SELECT l.project_id,SUM(c.amount) AS commitment FROM selected s JOIN request_lines l ON l.project_id=s.id JOIN commitments c ON c.request_line_id=l.id GROUP BY l.project_id),
        promised_rows AS (SELECT f.project_id,p.amount FROM selected s JOIN funding_sources f ON f.project_id=s.id JOIN promises p ON p.source_id=f.id UNION ALL SELECT f.project_id,a.amount FROM selected s JOIN funding_sources f ON f.project_id=s.id JOIN promises p ON p.source_id=f.id JOIN promise_adjustments a ON a.promise_id=p.id),
        promises_total AS (SELECT project_id,SUM(amount) AS promised FROM promised_rows GROUP BY project_id),
        ledger AS (SELECT l.project_id,
          SUM(CASE WHEN a.type IN('bank','cash','mobile') THEN l.amount ELSE 0 END) AS cash,
          SUM(CASE WHEN a.type='advance' THEN l.amount ELSE 0 END) AS advances,
          SUM(CASE WHEN a.type='payable' THEN l.amount ELSE 0 END) AS payable,
          SUM(CASE WHEN r.role IN('funding_deferred','funding_refundable') AND j.state='posted' AND j.date<='9999-12-31' THEN l.amount ELSE 0 END) AS deferred,
          SUM(CASE WHEN a.type IN('bank','cash','mobile') AND (j.kind='receipt' OR original.kind='receipt') THEN l.amount ELSE 0 END) AS received,
          SUM(CASE WHEN a.type='payable' AND (j.kind IN('payment','expense_payment','payroll_payment') OR original.kind IN('payment','expense_payment','payroll_payment')) THEN l.amount ELSE 0 END) AS payments
          FROM selected s JOIN journal_lines l ON l.project_id=s.id JOIN accounts a ON a.id=l.account_id JOIN journals j ON j.id=l.journal_id LEFT JOIN journals original ON original.id=j.reversal_of LEFT JOIN acc_line_roles r ON r.line_id=l.id GROUP BY l.project_id)
        SELECT s.id,COALESCE(b.approved,0) AS approved,COALESCE(c.actual,0) AS actual,COALESCE(v.commitment,0) AS commitment,COALESCE(p.promised,0) AS promised,
          COALESCE(g.cash,0) AS cash,COALESCE(g.advances,0) AS advances,COALESCE(g.received,0) AS received,COALESCE(g.payments,0) AS payments,
          -COALESCE(g.payable,0)+COALESCE(g.deferred,0) AS liability
        FROM selected s LEFT JOIN budgets b ON b.project_id=s.id LEFT JOIN charges c ON c.project_id=s.id LEFT JOIN reservations v ON v.project_id=s.id LEFT JOIN promises_total p ON p.project_id=s.id LEFT JOIN ledger g ON g.project_id=s.id`,...ids);
      return new Map(rows.map(({id,...m})=>{m.remaining=sum([m.approved,-m.actual,-m.commitment]);return [id,Object.fromEntries(Object.entries(m).map(([k,v])=>[k,decimal(sum([v]))]))];}));
    }
  };
}
