// Sequential callbacks keep a transaction's reads/writes ordered on its client.
export async function asyncArray(kind, values, callback, ...args) {
  const a=Array.from(values), out=[];
  if(kind==='reduce') { let i=args.length?0:1,value=args.length?args[0]:a[0];if(!a.length&&!args.length)throw TypeError('Reduce of empty array');for(;i<a.length;i++)value=await callback(value,a[i],i,a);return value; }
  if(kind==='sort'){for(const value of a){let i=out.length;while(i&&await callback(out[i-1],value)>0)i--;out.splice(i,0,value);}values.splice(0,values.length,...out);return values;}
  for(let i=0;i<a.length;i++){const value=await callback(a[i],i,a);if(kind==='map')out.push(value);else if(kind==='flatMap')out.push(...[value].flat());else if(kind==='filter'&&value)out.push(a[i]);else if(kind==='find'&&value)return a[i];else if(kind==='findIndex'&&value)return i;else if(kind==='some'&&value)return true;else if(kind==='every'&&!value)return false;}
  return kind==='some'?false:kind==='every'?true:kind==='find'?undefined:kind==='findIndex'?-1:kind==='forEach'?undefined:out;
}
