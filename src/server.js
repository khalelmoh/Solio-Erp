import {organizationBranding} from './branding.js';
import {backupHealth} from './operating-health.js';
import {verifySMTP} from './transport.js';
import {verifyProvider} from './operations-integrations.js';
import http from 'node:http';
import {timingSafeEqual,createHash,randomUUID} from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDatabase, defaultPath } from './db.js';
import { ERP, DomainError } from './service.js';
import { identityProvider } from './identity.js';
import {runtimeConfig,validateSessionCookieName} from './runtime.js';
import {backgroundJobs} from './jobs.js';
const applicationVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;

const assets = new Map([
  ['/workspace-experience.js', {file:'workspace-experience.js',type:'text/javascript; charset=utf-8'}],
  ['/favicon.svg', {file:'favicon.svg',type:'image/svg+xml'}],
  ['/dashboard-ui.js', {file:'dashboard-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/application-shell.js', {file:'application-shell.js',type:'text/javascript; charset=utf-8'}],
  ['/icons.js', {file:'icons.js',type:'text/javascript; charset=utf-8'}],
  ['/design.css', {file:'design.css',type:'text/css; charset=utf-8'}],
  ['/guided-form.js', {file:'guided-form.js',type:'text/javascript; charset=utf-8'}],
  ['/finance-wizards.js', {file:'finance-wizards.js',type:'text/javascript; charset=utf-8'}],
  ['/employee-wizard.js', {file:'employee-wizard.js',type:'text/javascript; charset=utf-8'}],
  ['/workspace-navigation.js', {file:'workspace-navigation.js',type:'text/javascript; charset=utf-8'}],
  ['/bill-wizard.js', {file:'bill-wizard.js',type:'text/javascript; charset=utf-8'}],
  ['/workspace.css', {file:'workspace.css',type:'text/css; charset=utf-8'}],
  ['/', {file:'index.html',type:'text/html; charset=utf-8'}],
  ['/organization-ui.js', {file:'organization-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/operations-ui.js', {file:'operations-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/people-ui.js', {file:'people-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/app.js', {file:'app.js',type:'text/javascript; charset=utf-8'}],
  ['/lifecycle-ui.js', {file:'lifecycle-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/completion-ui.js', {file:'completion-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/extensions-ui.js', {file:'extensions-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/hr-ui.js', {file:'hr-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/accounting-ui.js', {file:'accounting-ui.js',type:'text/javascript; charset=utf-8'}],
  ['/extensions.css', {file:'extensions.css',type:'text/css; charset=utf-8'}],
  ['/style.css', {file:'style.css',type:'text/css; charset=utf-8'}],
  ['/lifecycle.css', {file:'lifecycle.css',type:'text/css; charset=utf-8'}]
]);
export function createApp(db, {secureCookies=false,jobs={},publicOrigin=process.env.ERP_PUBLIC_ORIGIN||'',proxySecret=process.env.ERP_PROXY_SECRET||'',sessionCookie='erp_session'}={}) {
  const branding=organizationBranding();
  validateSessionCookieName(sessionCookie);
  const erp=new ERP(db);
  const instanceId=randomUUID();
  const identity=identityProvider(erp);
  const runner=backgroundJobs(erp,jobs);
  const oidcCookie=handle=>`erp_oidc=${handle}; HttpOnly; SameSite=Lax; Path=/api/oidc; Max-Age=${handle?600:0}${secureCookies?'; Secure':''}`;
  const cookie=token=>`${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?28800:0}${secureCookies?'; Secure':''}`;
  const json=(res,status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body));};
  async function body(req) {
    if(!req.headers['content-type']?.startsWith('application/json')) throw new DomainError('JSON content type required',415);
    let size=0; const parts=[];
    for await (const chunk of req) { size+=chunk.length; if(size>3*1024*1024) throw new DomainError('Request is too large',413); parts.push(chunk); }
    try { const data=JSON.parse(Buffer.concat(parts).toString('utf8')); if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error(); return data; } catch { throw new DomainError('Invalid JSON body'); }
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url=new URL(req.url,'http://localhost');
      if(proxySecret&&url.pathname.startsWith('/api/')){const supplied=req.headers['x-origin-secret'];if(typeof supplied!=='string'||Buffer.byteLength(supplied)!==Buffer.byteLength(proxySecret)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(proxySecret)))throw new DomainError('Trusted hosting proxy required',403);}
      if(req.method==='GET' && assets.has(url.pathname)) {
        const a=assets.get(url.pathname),version=encodeURIComponent(applicationVersion);let content=readFileSync(new URL(`../public/${a.file}`,import.meta.url),'utf8');
        if(a.file==='app.js'&&process.env.NODE_ENV==='production')content=content.replace(/  if\(el\.dataset\.demo\) \{[^\n]*\n/,'');
        if(a.file==='index.html')content=content.replace('v0.1','v'+applicationVersion);
        if(a.file==='index.html'&&process.env.NODE_ENV==='production')content=content.replace(/<details class="demo-help">[\s\S]*?<\/details>/,'');
        if(a.file==='index.html')content=content.replace(/(src|href)="(\/[\w-]+\.(?:js|css))"/g,(_,attribute,path)=>`${attribute}="${path}?v=${version}"`);
        if(a.file==='app.js')content=content.replace(/(\bfrom\s*['"])(\.\/[\w-]+\.js)(['"])/g,(_,before,path,after)=>`${before}${path}?v=${version}${after}`);
        res.writeHead(200,{'Content-Type':a.type,'Cache-Control':'no-store'});res.end(content);return;
      }
      if(req.method==='GET' && url.pathname==='/healthz'){erp.get('SELECT 1');return json(res,200,{status:'ok',quarantined:erp.quarantined()});}
      if(req.method==='GET' && url.pathname==='/api/health'){erp.get('SELECT 1');return json(res,200,{status:'ok',version:applicationVersion,instance_id:instanceId,database_provider:db.provider||process.env.ERP_DATABASE_PROVIDER||'sqlite',synthetic_staging:process.env.ERP_STAGING_SYNTHETIC_ONLY==='true'});}
      if(req.method==='GET' && url.pathname==='/api/auth/options')return json(res,200,{oidc:identity.enabled});
      if(req.method==='GET'&&url.pathname==='/api/branding')return json(res,200,branding.public);
      if(req.method==='GET'&&url.pathname==='/api/branding/logo'){if(!branding.logo)throw new DomainError('Organization logo has not been configured',404);res.writeHead(200,{'Content-Type':branding.logo.mime,'Cache-Control':'no-store'});res.end(branding.logo.bytes);return;}
      if(req.method==='POST' && /^\/api\/integrations\/\d+\/events$/.test(url.pathname)){
        let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65536)throw new DomainError('Integration event too large',413);chunks.push(chunk);}
        return json(res,200,erp.inbound(Number(url.pathname.split('/')[3]),Buffer.concat(chunks).toString('utf8'),req.headers['x-erp-timestamp'],req.headers['x-erp-signature']));
      }
      if(req.method==='POST') {
        if(req.headers.origin) { let origin;try{origin=new URL(req.headers.origin);}catch{throw new DomainError('Invalid request origin',403);} if((publicOrigin?origin.origin!==new URL(publicOrigin).origin:origin.host!==req.headers.host) || !['http:','https:'].includes(origin.protocol)) throw new DomainError('Cross-origin mutation denied',403); }
        if(req.headers['sec-fetch-site']==='cross-site') throw new DomainError('Cross-site mutation denied',403);
      }
      const token=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
      const oidcHandle=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('erp_oidc='))?.slice(9);
      if(req.method==='POST'&&url.pathname==='/api/oidc/start'){
        erp.rateLimit('oidc:'+req.socket.remoteAddress,20);
        const result=await identity.start();return json(res,200,{url:result.url},{'Set-Cookie':oidcCookie(result.handle)});
      }
      if(req.method==='GET'&&url.pathname==='/api/oidc/callback'){
        const result=await identity.callback(oidcHandle,url.search);res.writeHead(303,{'Location':result.mfa_required?'/?oidc_mfa=1':'/','Set-Cookie':result.mfa_required?oidcCookie(oidcHandle):[cookie(result.token),oidcCookie('')],'Cache-Control':'no-store'});res.end();return;
      }
      if(req.method==='POST'&&url.pathname==='/api/oidc/finish'){
        const data=await body(req);erp.rateLimit('oidc-mfa:'+req.socket.remoteAddress,10);
        const result=identity.finish(oidcHandle,data.otp);return json(res,200,{user:result.user},{'Set-Cookie':[cookie(result.token),oidcCookie('')]});
      }
      if(req.method==='POST' && url.pathname==='/api/login') {
        const data=await body(req),ip=req.socket.remoteAddress;
        erp.rateLimit('login-ip:'+ip,200);erp.rateLimit('login-account:'+String(data.email||'').toLowerCase().slice(0,320),10);
        const result=erp.login(data.email,data.password,data.otp);erp.run('DELETE FROM auth_limits WHERE bucket=?',createHash('sha256').update('login-account:'+String(data.email||'').toLowerCase().slice(0,320)).digest('hex'));
        return json(res,200,{user:result.user},{'Set-Cookie':cookie(result.token)});
      }
      if(req.method==='POST'&&url.pathname==='/api/password/reset'){erp.rateLimit('password-reset:'+req.socket.remoteAddress,10);return json(res,200,erp.completePasswordReset(await body(req)));}
      if(req.method==='GET'&&!url.pathname.startsWith('/api/')){const name=(branding.public.name||'Organization workspace').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(new URL('../public/error.html',import.meta.url),'utf8').replaceAll('{{ORG_NAME}}',name));return;}
      const actor=erp.authenticate(token);
      if(req.method==='GET'&&url.pathname==='/api/setup-checklist')return json(res,200,erp.setupChecklist(actor));
      if(req.method==='GET'&&/^\/api\/record-details\/(organization|request|bill|receipt|advance)\/\d+$/.test(url.pathname)){const parts=url.pathname.split('/'),id=Number(parts[4]);return json(res,200,parts[3]==='organization'?erp.organizationRecord(actor,id):erp.projectRecord(actor,parts[3],id,Number(url.searchParams.get('project_id'))));}
      if(req.method==='GET'&&/^\/api\/dashboard\/journals\/\d+$/.test(url.pathname))return json(res,200,erp.dashboardJournal(actor,Number(url.pathname.split('/').pop()),Object.fromEntries(url.searchParams)));
      if(req.method==='GET'&&url.pathname==='/api/dashboard/bootstrap')return json(res,200,{...erp.dashboardBootstrap(actor),application_version:applicationVersion});
      if(req.method==='GET'&&url.pathname==='/api/dashboard')return json(res,200,erp.workspaceDashboard(actor,Object.fromEntries(url.searchParams)));
      if(req.method==='GET'&&url.pathname==='/api/dashboard/records')return json(res,200,erp.dashboardRecords(actor,Object.fromEntries(url.searchParams)));
      if(req.method==='GET'&&(/\.csv$/.test(url.pathname)||/^\/api\/(?:payslips\/|accounting\/reports\/|hr\/reports)/.test(url.pathname))){res.once('finish',()=>{if(res.statusCode===200)try{erp.insert('audit',{actor_id:actor,action:'security.export',entity:url.pathname,details:'{}'});}catch{console.error(JSON.stringify({event:'audit.write.failed'}));}});}
      if(req.method==='GET'&&url.pathname==='/api/jobs'){erp.admin(actor);return json(res,200,{...runner.status,backup:backupHealth(),quarantined:erp.quarantined()});}
      if(req.method==='POST' && url.pathname==='/api/logout') { erp.logout(token);return json(res,200,{ok:true},{'Set-Cookie':cookie('')}); }
      if(req.method==='GET' && url.pathname==='/api/config') return json(res,200,{...erp.config(actor),application_version:applicationVersion});
      if(req.method==='POST' && /^\/api\/providers\/\d+\/verify$/.test(url.pathname)){await body(req);return json(res,200,await verifyProvider(erp,actor,Number(url.pathname.split('/')[3])));}
      if(req.method==='POST' && url.pathname==='/api/providers/smtp/verify'){await body(req);return json(res,200,await verifySMTP(erp,actor));}
      if(req.method==='POST' && url.pathname==='/api/operations/entitlements')return json(res,200,erp.finalEntitlements(actor,await body(req)));
      if(req.method==='GET' && url.pathname==='/api/people')return json(res,200,erp.lifecycleOverview(actor,Object.fromEntries(url.searchParams)));
      if(req.method==='GET' && url.pathname==='/api/people/report.csv'){const csv=erp.lifecycleCSV(actor,Object.fromEntries(url.searchParams));res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="employee-lifecycle.csv"','Cache-Control':'no-store'});res.end(csv);return;}
      if(req.method==='GET' && /^\/api\/people\/files\/\d+$/.test(url.pathname)){const f=erp.lifecycleFile(actor,Number(url.pathname.split('/').pop()));res.writeHead(200,{'Content-Type':f.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,'Cache-Control':'no-store'});res.end(Buffer.from(f.content,'base64'));return;}
      if(req.method==='GET' && url.pathname==='/api/accounting')return json(res,200,erp.accountingOverview(actor));
      if(req.method==='GET' && url.pathname==='/api/organization-finance')return json(res,200,erp.orgOverview(actor));
      if(req.method==='GET' && /^\/api\/organization-finance\/journals\/\d+$/.test(url.pathname))return json(res,200,erp.orgJournal(actor,Number(url.pathname.split('/').pop())));
      if(req.method==='GET' && url.pathname==='/api/organization-finance/report')return json(res,200,erp.orgReport(actor,Object.fromEntries(url.searchParams)));
      if(req.method==='GET' && url.pathname==='/api/organization-finance/report.csv'){const csv=erp.orgCSV(actor,Object.fromEntries(url.searchParams));res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="organization-finance.csv"','Cache-Control':'no-store'});res.end(csv);return;}
      if(req.method==='GET' && /^\/api\/accounting\/reports\/[a-z_]+(\.csv)?$/.test(url.pathname)){
        const kind=url.pathname.split('/').pop().replace('.csv',''),filters=Object.fromEntries(url.searchParams);
        if(url.pathname.endsWith('.csv')){const csv=erp.accountingCSV(actor,kind,filters);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="accounting-${kind}.csv"`,'Cache-Control':'no-store'});res.end(csv);return;}
        return json(res,200,erp.accountingReport(actor,kind,filters));
      }
      if(req.method==='GET' && url.pathname==='/api/accounting/reconciliation')return json(res,200,erp.controlReconciliation(actor,url.searchParams.get('to')||undefined));
      if(req.method==='GET' && /^\/api\/accounting\/periods\/\d+$/.test(url.pathname))return json(res,200,erp.periodChecklist(actor,Number(url.pathname.split('/').pop())));
      if(req.method==='GET' && /^\/api\/accounting\/evidence\/\d+$/.test(url.pathname)){
        const doc=erp.accountingEvidence(actor,Number(url.pathname.split('/').pop()));res.writeHead(200,{'Content-Type':doc.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,'Cache-Control':'no-store'});res.end(Buffer.from(doc.content,'base64'));return;
      }
      if(req.method==='GET' && /^\/api\/accounting\/assets(\.csv)?$/.test(url.pathname)){
        const to=url.searchParams.get('to')||undefined;if(url.pathname.endsWith('.csv')){const csv=erp.assetCSV(actor,to);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="fixed-assets.csv"','Cache-Control':'no-store'});res.end(csv);return;}return json(res,200,erp.assetRegister(actor,to));
      }
      if(req.method==='GET' && url.pathname==='/api/projects') return json(res,200,erp.projectPage(actor,Object.fromEntries(url.searchParams)));
      if(req.method==='GET' && /^\/api\/projects\/\d+$/.test(url.pathname)) return json(res,200,erp.dashboard(actor,Number(url.pathname.split('/').pop())));
      if(req.method==='GET' && /^\/api\/projects\/\d+\/report(\.csv)?$/.test(url.pathname)) {
        const id=Number(url.pathname.split('/')[3]),filters=Object.fromEntries(url.searchParams);
        if(url.pathname.endsWith('.csv')){const csv=erp.reportCSV(actor,id,filters);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="project-${id}-financial-statement.csv"`,'Cache-Control':'no-store'});res.end(csv);return;}
        return json(res,200,erp.report(actor,id,filters));
      }
      if(req.method==='GET' && url.pathname==='/api/reconciliation')return json(res,200,erp.reconciliationOverview(actor));
      if(req.method==='GET' && /^\/api\/procurement\/(po|voucher)\/\d+$/.test(url.pathname))return json(res,200,erp.procurementDocument(actor,url.pathname.split('/')[3],Number(url.pathname.split('/')[4])));
      if(req.method==='GET' && url.pathname==='/api/catalog')return json(res,200,erp.catalog(actor));
      if(req.method==='GET' && url.pathname==='/api/inbox')return json(res,200,{notifications:erp.inbox(actor)});
      if(req.method==='GET' && url.pathname==='/api/my-work')return json(res,200,erp.myHR(actor));
      if(req.method==='GET' && url.pathname==='/api/hr')return json(res,200,erp.hrOverview(actor));
      if(req.method==='GET' && url.pathname==='/api/hr/stage3')return json(res,200,erp.hrStageOverview(actor));
      if(req.method==='GET' && /^\/api\/hr\/attendance-imports\/\d+$/.test(url.pathname))return json(res,200,erp.attendanceImportReview(actor,Number(url.pathname.split('/').pop())));
      if(req.method==='GET' && /^\/api\/hr\/payment-details\/\d+$/.test(url.pathname))return json(res,200,erp.paymentDetailsReview(actor,Number(url.pathname.split('/').pop())));
      if(req.method==='POST' && url.pathname==='/api/hr/payroll/preview')return json(res,200,erp.managedPayrollPreview(actor,await body(req)));
      if(req.method==='GET' && /^\/api\/hr\/reports(\.csv)?$/.test(url.pathname)){
        const filters=Object.fromEntries(url.searchParams);if(url.pathname.endsWith('.csv')){const csv=erp.hrReportsCSV(actor,filters);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="hr-reports.csv"','Cache-Control':'no-store'});res.end(csv);return;}return json(res,200,erp.hrReports(actor,filters));
      }
      if(req.method==='GET' && /^\/api\/hr\/documents\/\d+$/.test(url.pathname)){
        const doc=erp.hrDocument(actor,Number(url.pathname.split('/').pop()));res.writeHead(200,{'Content-Type':doc.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,'Cache-Control':'no-store'});res.end(Buffer.from(doc.content,'base64'));return;
      }
      if(req.method==='GET' && /^\/api\/hr\/batches\/\d+\.csv$/.test(url.pathname)){
        const id=Number(url.pathname.split('/').pop().replace('.csv','')),csv=erp.paymentBatchCSV(actor,id);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="payroll-batch-${id}.csv"`,'Cache-Control':'no-store'});res.end(csv);return;
      }
      if(req.method==='GET' && /^\/api\/projects\/\d+\/salary-costs(\.csv)?$/.test(url.pathname)){
        const id=Number(url.pathname.split('/')[3]),result=erp.projectSalaryCosts(actor,id,Object.fromEntries(url.searchParams));if(url.pathname.endsWith('.csv')){const csv=erp.projectSalaryCSV(actor,id,Object.fromEntries(url.searchParams));res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="project-${id}-salary-costs.csv"`,'Cache-Control':'no-store'});res.end(csv);return;}return json(res,200,result);
      }
      if(req.method==='POST' && url.pathname==='/api/payroll/preview')return json(res,200,erp.payrollPreview(actor,await body(req)));
      if(req.method==='GET' && /^\/api\/payroll\/\d+\/register(\.csv)?$/.test(url.pathname)){
        const id=Number(url.pathname.split('/')[3]);if(url.pathname.endsWith('.csv')){const csv=erp.payrollRegisterCSV(actor,id);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="payroll-${id}.csv"`,'Cache-Control':'no-store'});res.end(csv);return;}return json(res,200,erp.payrollRegister(actor,id));
      }
      if(req.method==='GET' && /^\/api\/projects\/\d+\/inventory(\.csv)?$/.test(url.pathname)){
        const id=Number(url.pathname.split('/')[3]),filters=Object.fromEntries(url.searchParams);if(url.pathname.endsWith('.csv')){const csv=erp.inventoryCSV(actor,id,filters);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="inventory-${id}.csv"`,'Cache-Control':'no-store'});res.end(csv);return;}return json(res,200,erp.inventoryOverview(actor,id,filters));
      }
      if(req.method==='GET' && url.pathname==='/api/integrations')return json(res,200,erp.integrationOverview(actor));
      if(req.method==='GET' && url.pathname==='/api/currencies')return json(res,200,erp.foreignOverview(actor));
      if(req.method==='GET' && /^\/api\/projects\/\d+\/work$/.test(url.pathname))return json(res,200,erp.projectExtras(actor,Number(url.pathname.split('/')[3])));
      if(req.method==='GET' && /^\/api\/payslips\/\d+\/\d+$/.test(url.pathname))return json(res,200,erp.payslip(actor,Number(url.pathname.split('/')[3]),Number(url.pathname.split('/')[4])));
      if(req.method==='GET' && /^\/api\/documents\/\d+$/.test(url.pathname)) {
        const doc=erp.document(actor,Number(url.pathname.split('/').pop()));res.writeHead(200,{'Content-Type':doc.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,'Content-Length':doc.bytes,'Cache-Control':'no-store'});res.end(Buffer.from(doc.content));return;
      }
      if(req.method==='POST' && url.pathname==='/api/actions') { const d=await body(req); return json(res,200,erp.execute(actor,d.action,d.data,req.headers['idempotency-key'])); }
      throw new DomainError('Route not found',404);
    } catch(e) { if(!(e instanceof DomainError)) console.error(JSON.stringify({event:'request.failed',id:randomUUID(),error_class:e.name})); json(res,e.status||500,{error:e.status?e.message:'An internal error occurred; the transaction was not posted'}); }
  });
  server.requestTimeout=30000;server.headersTimeout=10000;server.maxRequestsPerSocket=1000;
  server.jobs=runner;server.once('listening',()=>runner.start());server.once('close',()=>runner.stop());return server;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  if(['postgres','supabase'].includes(process.env.ERP_DATABASE_PROVIDER)){await (await import('./postgres-runtime.js')).startPostgres();}else{
  const config=runtimeConfig();
  const db=openDatabase(process.env.ERP_DB||defaultPath);
  const server=createApp(db,{secureCookies:config.secureCookies,jobs:config.jobs});
  const {port,host}=config;
  server.listen(port,host,()=>console.log(`Funded Projects ERP: http://${host}:${port} — local milestone, not production-ready`));
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await server.jobs.stop();server.close(()=>{db.close();process.exit(0);});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  }
}
