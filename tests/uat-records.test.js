import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {prepareWorksheet,reviewTemplate,recordReview,reviewStatus,declaration} from '../scripts/uat-records.js';

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'folio-uat-'));
  mkdirSync(join(root,'docs'));mkdirSync(join(root,'artifacts'));writeFileSync(join(root,'package.json'),JSON.stringify({version:'test'}));writeFileSync(join(root,'docs/policy-approval-packet.md'),'Synthetic policy proposal');writeFileSync(join(root,'artifacts/evidence.txt'),'Synthetic result');
  prepareWorksheet('finance',{scripts:['fake-test.js'],steps:[['Inspect amount','1500 USD cost and cash reduction']]},root);
  const review=()=>({...reviewTemplate('finance',root),reviewer:{name:'Synthetic Test Reviewer',organization_role:'Test Finance',authority:'Isolated automated fixture only; no real authority'},reviewed_at:new Date().toISOString(),decision:'accepted',declaration,steps:[{id:'FINANCE-1',actual:'Observed 1500 USD cost and cash decrease in this fixture',result:'passed',evidence:['artifacts/evidence.txt']}]});
  return {root,review,cleanup(){assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('folio-uat-'));rmSync(root,{recursive:true,force:true});}};
}

test('UAT preparation preserves entered findings and review history',()=>{const f=fixture();try{
  const path=join(f.root,'artifacts/uat/finance.json'),worksheet=JSON.parse(readFileSync(path));worksheet.steps[0].actual='A reviewer entered a finding';writeFileSync(path,JSON.stringify(worksheet));
  prepareWorksheet('finance',{scripts:[],steps:[]},f.root);assert.equal(JSON.parse(readFileSync(path)).steps[0].actual,'A reviewer entered a finding');
  const one=recordReview(f.review(),f.root),two=recordReview({...f.review(),decision:'requires_changes',unresolved_defects:['Follow-up review requested']},f.root);assert.notEqual(one.path,two.path);assert.equal(readdirSync(join(f.root,'artifacts/uat/reviews')).length,2);assert.equal(reviewStatus(f.root)[0].human_acceptance,'requires_changes');
}finally{f.cleanup();}});

test('UAT cannot record incomplete, unsupported or undeclared acceptance',()=>{const f=fixture();try{
  for(const override of [{declaration:''},{reviewer:{name:'',organization_role:'Test',authority:'Test'}},{scope:'production'},{reviewed_at:'2099-01-01T00:00:00Z'},{steps:[]},{steps:[{id:'FINANCE-1',actual:'Observed failure',result:'failed',evidence:['artifacts/evidence.txt']}]},{unresolved_defects:['Open blocker']},{steps:[{id:'FINANCE-1',actual:'Observed amount',result:'passed',evidence:[]}]}])assert.throws(()=>recordReview({...f.review(),...override},f.root));
  assert.equal(reviewStatus(f.root)[0].human_acceptance,'pending');
}finally{f.cleanup();}});

test('UAT evidence and policy/build changes invalidate old acceptance without erasing it',()=>{const f=fixture();try{
  const review=f.review(),saved=recordReview(review,f.root);assert.equal(reviewStatus(f.root)[0].human_acceptance,'accepted');
  writeFileSync(join(f.root,'artifacts/evidence.txt'),'Changed evidence');assert.equal(reviewStatus(f.root)[0].human_acceptance,'stale_review');
  writeFileSync(join(f.root,'artifacts/evidence.txt'),'Synthetic result');assert.equal(reviewStatus(f.root)[0].human_acceptance,'accepted');
  const worksheetPath=join(f.root,'artifacts/uat/finance.json'),original=readFileSync(worksheetPath,'utf8'),worksheet=JSON.parse(original);worksheet.steps[0].expected='An altered result';writeFileSync(worksheetPath,JSON.stringify(worksheet));assert.equal(reviewStatus(f.root)[0].human_acceptance,'stale_review');assert.throws(()=>recordReview(review,f.root),/Worksheet/);writeFileSync(worksheetPath,original);
  writeFileSync(join(f.root,'docs/policy-approval-packet.md'),'New policy revision');assert.equal(reviewStatus(f.root)[0].human_acceptance,'stale_review');assert.throws(()=>recordReview(review,f.root),/changed/);assert.equal(JSON.parse(readFileSync(join(f.root,saved.path))).decision,'accepted');
}finally{f.cleanup();}});

test('UAT rejects absent, secret and escaping evidence references',()=>{const f=fixture();try{
  for(const evidence of [['.env'],['artifacts/secret.key'],['docs/../../outside.txt'],['artifacts/missing.txt']])assert.throws(()=>recordReview({...f.review(),steps:[{id:'FINANCE-1',actual:'Observed amount',result:'passed',evidence}]},f.root));
}finally{f.cleanup();}});
