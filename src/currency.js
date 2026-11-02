import {LIMIT} from './money.js';
export function minor(value,scale=2,{signed=false,zero=false}={}){
  if(typeof value!=='string'||!new RegExp(`^-?\\d{1,10}(\\.\\d{1,${Math.max(1,scale)}})?$`).test(value)||(scale===0&&value.includes('.')))throw new Error(`Amount must be decimal text at currency scale ${scale}`);
  const negative=value.startsWith('-'),[whole,fraction='']=value.replace('-','').split('.');if(fraction.length>scale)throw new Error('Currency precision exceeded');
  const n=Number(BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0')||'0'))*(negative?-1:1);if(!Number.isSafeInteger(n)||Math.abs(n)>LIMIT||(!signed&&n<0)||(!zero&&!n))throw new Error('Amount outside currency bounds');return n;
}
export function formatMinor(n,scale=2){const a=BigInt(n<0?-n:n),factor=10n**BigInt(scale);return `${n<0?'-':''}${a/factor}${scale?'.'+String(a%factor).padStart(scale,'0'):''}`;}
export function ratio(value){if(typeof value!=='string'||!/^\d{1,10}(\.\d{1,8})?$/.test(value))throw new Error('Rate must be positive decimal text with at most 8 places');const [a,b='']=value.split('.'),numerator=BigInt(a+b),denominator=10n**BigInt(b.length);if(!numerator)throw new Error('Rate must be positive');return{numerator:numerator.toString(),denominator:denominator.toString()};}
export function roundedFraction(n,d){const negative=n<0n;n=negative?-n:n;const value=(n+d/2n)/d;const result=Number(negative?-value:value);if(!Number.isSafeInteger(result)||Math.abs(result)>LIMIT)throw new Error('Converted amount outside safe bounds');return result;}
export function convert(units,scale,rate){return roundedFraction(BigInt(units)*BigInt(rate.numerator)*100n,10n**BigInt(scale)*BigInt(rate.denominator));}
