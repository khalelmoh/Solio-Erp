import {spawn} from 'node:child_process';
const domain=['accounting.test','accounting-assets.test','organization-finance.test','dashboard.test','workspace-experience.test','stage3.test','people.test','employee-permissions.test','payroll-inventory.test','identity.test'].map(n=>'tests/'+n+'.js');
const browsers=['browser-guided-workflows','browser-employee-registration','browser-finance-usability','browser-organization-finance','browser-accounting','browser-stage3','browser-people','browser-payroll-inventory','browser-dashboard','browser-workspace-journeys','browser-leave-journey'].map(n=>'scripts/'+n+'.js');
async function run(args){const status=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});p.once('error',reject);p.once('exit',resolve);});if(status!==0)throw Error('PostgreSQL verification failed: '+args.join(' '));}
await run(['scripts/prepare-postgres-tests.js',...domain,...browsers,'scripts/browser-navigation.js']);
if(process.argv.includes('--browser')){for(const script of browsers)await run(['.cache/postgres-runtime/'+script]);}
else{await run(['--test','--test-concurrency=1','--test-skip-pattern=paired-key backup restore',...domain.map(n=>'.cache/postgres-runtime/'+n),'tests/postgres/contracts.test.js']);}
