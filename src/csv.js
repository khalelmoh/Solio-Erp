// RFC 4180 fields, including quoted commas, quotes and newlines.
export function parseCSV(input) {
  if(typeof input!=='string' || input.length>1500000)throw new Error('Invalid or oversized CSV');
  input=input.replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false,ended=false;
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;ended=true;}}else field+=c;continue;}
    if(c==='"'){if(field||ended)throw new Error('Malformed quoted CSV field');quoted=true;}
    else if(c===','){row.push(field);field='';ended=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.length))rows.push(row);row=[];field='';ended=false;}
    else {if(ended)throw new Error('Unexpected text after quoted CSV field');field+=c;}
  }
  if(quoted)throw new Error('Unclosed quoted CSV field');
  row.push(field);if(row.some(v=>v.length))rows.push(row);
  return rows;
}
export function exportCSV(rows) {
  const cell=v=>{
    let s=String(v??'');
    // Values that are exact decimal numbers are safe; user text may be a formula.
    if(!/^-?\d+(\.\d+)?$/.test(s)&&/^[\s]*[=+\-@]/.test(s))s="'"+s;
    return `"${s.replaceAll('"','""')}"`;
  };
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
