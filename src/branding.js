import {readFileSync,statSync} from 'node:fs';
export function organizationBranding(env=process.env){
  const name=env.ERP_ORGANIZATION_NAME?.trim()||null;if(name&&(name.length>140||/[\x00-\x1f]/.test(name)))throw Error('ERP_ORGANIZATION_NAME must contain 1–140 display characters');
  let logo=null;if(env.ERP_ORGANIZATION_LOGO_FILE){if(statSync(env.ERP_ORGANIZATION_LOGO_FILE).size>2097152)throw Error('Organization logo must be at most 2 MiB');const bytes=readFileSync(env.ERP_ORGANIZATION_LOGO_FILE),mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;if(!mime)throw Error('Organization logo must be a PNG, JPEG or WebP image');logo={bytes,mime};}
  return{name,logo,public:{name,logo_url:logo?'/api/branding/logo':null,configured:!!name,synthetic:env.ERP_STAGING_SYNTHETIC_ONLY==='true'}};
}
