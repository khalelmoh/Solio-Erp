import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Compile the existing domain into async calls. Business rules have one source;
// PostgreSQL uses actual nonblocking pg queries, never a synchronous RPC shim.
export function buildPostgresRuntime({output=resolve('.cache/postgres-runtime'),extra=[]}={}){
  const names=readdirSync('src').filter(n=>n.endsWith('.js')&&!n.startsWith('postgres-')&&!['db.js','retention-schema.js','recovery.js','backup.js'].includes(n));
  const files=[...names.map(n=>resolve('src',n)),...extra.map(n=>resolve(n))];
  const program=ts.createProgram(files,{allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,skipLibCheck:true});
  const checker=program.getTypeChecker(), selected=new Set(files),functions=[],owner=new Map(),calls=[],asyncFns=new Set(),transactions=new Map();
  const isFn=n=>!!n&&ts.isFunctionLike(n)&&!!n.body;
  for(const sf of program.getSourceFiles().filter(s=>selected.has(resolve(s.fileName)))){
    function walk(n,fn){if(isFn(n)){fn=n;functions.push(n);if(n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))asyncFns.add(n);}if(fn)owner.set(n,fn);if(ts.isCallExpression(n))calls.push(n);ts.forEachChild(n,c=>walk(c,fn));}walk(sf,null);
  }
  for(const call of calls)if(ts.isPropertyAccessExpression(call.expression)&&call.expression.name.text==='exec'&&ts.isStringLiteral(call.arguments[0])&&/^BEGIN(?: IMMEDIATE)?$/i.test(call.arguments[0].text)){transactions.set(owner.get(call),call.expression.expression);asyncFns.add(owner.get(call));}
  function target(n){if(!n)return null;let symbol=checker.getSymbolAtLocation(n);if(symbol?.flags&ts.SymbolFlags.Alias){try{symbol=checker.getAliasedSymbol(symbol);}catch{}}let d=symbol?.valueDeclaration||symbol?.declarations?.[0];if(d&&ts.isShorthandPropertyAssignment(d)){symbol=checker.getShorthandAssignmentValueSymbol(d);d=symbol?.valueDeclaration||symbol?.declarations?.[0];}return isFn(d)?d:d&&ts.isVariableDeclaration(d)&&isFn(d.initializer)?d.initializer:null;}
  const arrays=new Set(['map','filter','find','findIndex','some','every','reduce','forEach','sort','flatMap']);
  function promiseArgument(n){const p=n.parent;if(ts.isCallExpression(p)&&/^(?:assert\.(?:rejects|doesNotReject)|Promise\.resolve)$/.test(p.expression.getText()))return true;if(ts.isPropertyAccessExpression(p)&&['then','catch','finally'].includes(p.name.text))return true;if(ts.isArrayLiteralExpression(p)&&ts.isCallExpression(p.parent)&&/^Promise\.(?:all|allSettled|race|any)$/.test(p.parent.expression.getText()))return true;return false;}
  const asynchronous=n=>asyncFns.has(n)||asyncFns.has(target(n));
  function direct(call){const x=call.expression,t=x.getText();return /^(?:this\.|this\[|erp\.|e\.|db\.|f\.(?:erp\.|op$|post$|doc$|spending$))/.test(t)&&!t.endsWith('.prepare')||['op','read','callback','openDatabase','fixture','accountingFixture','organizationFixture'].includes(t)||/^base(?:\.|\[)/.test(t)||/^(?:read|original)\.(?:apply|call)$/.test(t)||['get','all','run','exec','close'].includes(x.name?.text)&&/\.prepare\(/.test(t)||asynchronous(x)||ts.isPropertyAccessExpression(x)&&arrays.has(x.name.text)&&asynchronous(call.arguments[0])||/^assert\.(?:throws|doesNotThrow)$/.test(t)&&asynchronous(call.arguments[0]);}
  let changed=true;while(changed){changed=false;for(const call of calls)if(direct(call)){const fn=owner.get(call);if(fn&&!ts.isConstructorDeclaration(fn)&&!asyncFns.has(fn)){asyncFns.add(fn);changed=true;}}}
  // Calls through optional-function parameters (fixture op callbacks) have
  // symbols too; propagation above reaches their callers to a fixed point.
  const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}), f=ts.factory;
  const transform=context=>{
    const visit=n=>{
      if(ts.isStringLiteral(n)&&/[/\\](?:tests|scripts)[/\\]/.test(n.getSourceFile().fileName)&&/^artifacts(?:\/|$)/.test(n.text))return f.createStringLiteral(n.text.replace(/^artifacts/,'artifacts/postgres'));
      if(ts.isCallExpression(n)){
        const original=n,x=n.expression;
        if(/^assert\.(?:throws|doesNotThrow)$/.test(x.getText())&&asynchronous(n.arguments[0]))return f.createParenthesizedExpression(f.createAwaitExpression(f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('assert'),x.name.text==='throws'?'rejects':'doesNotReject'),undefined,n.arguments.map(a=>ts.visitNode(a,visit)))));
        if(ts.isPropertyAccessExpression(x)&&arrays.has(x.name.text)&&asynchronous(n.arguments[0])){
          const args=[f.createStringLiteral(x.name.text),ts.visitNode(x.expression,visit),...n.arguments.map(a=>ts.visitNode(a,visit))];
          return f.createParenthesizedExpression(f.createAwaitExpression(f.createCallExpression(f.createIdentifier('__asyncArray'),undefined,args)));
        }
        n=ts.visitEachChild(n,visit,context);
        if(direct(original)&&!ts.isAwaitExpression(original.parent)&&!promiseArgument(original))return f.createParenthesizedExpression(f.createAwaitExpression(n));
        return n;
      }
      const original=n;n=ts.visitEachChild(n,visit,context);
      if(transactions.has(original)&&n.body&&ts.isBlock(n.body)){
        const scope=ts.visitNode(transactions.get(original),visit),callback=f.createArrowFunction([f.createModifier(ts.SyntaxKind.AsyncKeyword)],undefined,[],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),n.body);
        const body=f.createBlock([f.createReturnStatement(f.createAwaitExpression(f.createCallExpression(f.createPropertyAccessExpression(scope,'withSession'),undefined,[callback])))],true);
        if(ts.isFunctionDeclaration(n))n=f.updateFunctionDeclaration(n,n.modifiers,n.asteriskToken,n.name,n.typeParameters,n.parameters,n.type,body);
        else if(ts.isFunctionExpression(n))n=f.updateFunctionExpression(n,n.modifiers,n.asteriskToken,n.name,n.typeParameters,n.parameters,n.type,body);
        else if(ts.isArrowFunction(n))n=f.updateArrowFunction(n,n.modifiers,n.typeParameters,n.parameters,n.type,n.equalsGreaterThanToken,body);
        else if(ts.isMethodDeclaration(n))n=f.updateMethodDeclaration(n,n.modifiers,n.asteriskToken,n.name,n.questionToken,n.typeParameters,n.parameters,n.type,body);
      }
      if(asyncFns.has(original)&&!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)){
        const mods=[...(n.modifiers||[]),f.createModifier(ts.SyntaxKind.AsyncKeyword)];
        if(ts.isFunctionDeclaration(n))return f.updateFunctionDeclaration(n,mods,n.asteriskToken,n.name,n.typeParameters,n.parameters,n.type,n.body);
        if(ts.isFunctionExpression(n))return f.updateFunctionExpression(n,mods,n.asteriskToken,n.name,n.typeParameters,n.parameters,n.type,n.body);
        if(ts.isArrowFunction(n))return f.updateArrowFunction(n,mods,n.typeParameters,n.parameters,n.type,n.equalsGreaterThanToken,n.body);
        if(ts.isMethodDeclaration(n))return f.updateMethodDeclaration(n,mods,n.asteriskToken,n.name,n.questionToken,n.typeParameters,n.parameters,n.type,n.body);
      }
      return n;
    };return sf=>ts.visitNode(sf,visit);
  };
  mkdirSync(join(output,'src'),{recursive:true});mkdirSync(join(output,'public'),{recursive:true});
  for(const file of readdirSync('public'))copyFileSync(join('public',file),join(output,'public',file));
  copyFileSync('package.json',join(output,'package.json'));
  const hashes=[];
  for(const path of files){const sf=program.getSourceFile(path),result=ts.transform(sf,[transform]);let code=printer.printFile(result.transformed[0]);result.dispose();code='// GENERATED async runtime; edit the canonical source, then rebuild.\nimport {asyncArray as __asyncArray} from '+JSON.stringify(pathToFileURL(resolve('src/postgres-async-arrays.js')).href)+';\n'+code;
    const relative=path.slice(resolve('.').length+1);mkdirSync(resolve(output,relative,'..'),{recursive:true});writeFileSync(join(output,relative),code);hashes.push({path:relative,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});}
  writeFileSync(join(output,'src/db.js'),'export {openPostgres as openDatabase} from '+JSON.stringify(pathToFileURL(resolve('src/postgres-db.js')).href)+'; export const defaultPath=undefined;\n');
  // Encryption is local CPU work; PostgreSQL always supplies the already
  // validated record key before any records can be accessed.
  copyFileSync('src/secure.js',join(output,'src/secure.js'));
  for(const name of ['recovery.js','backup.js','retention-schema.js'])copyFileSync(join('src',name),join(output,'src',name));
  for(const path of ['package.json',...readdirSync('public').map(n=>'public/'+n)])hashes.push({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
  writeFileSync(join(output,'source-manifest.json'),JSON.stringify({built_at:new Date().toISOString(),functions:asyncFns.size,source:hashes},null,2));
  return{output,files:files.length,async_functions:asyncFns.size};
}
if(process.argv[1]===new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))console.log(JSON.stringify(buildPostgresRuntime()));
