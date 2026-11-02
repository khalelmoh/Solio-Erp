import {chmodSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

// Fail closed if an archive/secret cannot be restricted to its service identity.
export function restrictFile(path){
  const directory=statSync(path).isDirectory();
  if(process.platform==='win32'){
    const identity=execFileSync('whoami',[],{encoding:'utf8',windowsHide:true}).trim();
    execFileSync('icacls',[path,'/inheritance:r','/grant:r',identity+':'+(directory?'(OI)(CI)':'')+'F'],{stdio:'pipe',windowsHide:true});
  }else chmodSync(path,directory?0o700:0o600);
}
