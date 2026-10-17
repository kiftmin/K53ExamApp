const fs = require('fs');
function normalize(s) {
  if (!s) return '';
  return String(s).replace(/\*\*/g, '').replace(/\r/g,'').replace(/\n/g,' ').replace(/\(\s*[ivxl]+\)\s*/gi,'').replace(/[^\w\s'-]/g,' ').replace(/\s+/g,' ').trim();
}
const items = JSON.parse(fs.readFileSync('documents/card-texts-to-format.json','utf8'));
const map = new Map();
for (const it of items) map.set(`${it.table}|${it.field}|${it.id}`, it.text);
const files = ['documents/formatted-rules-body.json','documents/formatted-signs-where.json','documents/formatted-signs-purpose.json','documents/formatted-signs-action.json'];
const out = [];
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(f,'utf8'));
  for (const it of arr) {
    const raw = map.get(`${it.table}|${it.field}|${it.id}`);
    if (raw===undefined || normalize(raw)!==normalize(it.formatted_text)) {
      out.push({id: it.id, table: it.table, field: it.field, raw: normalize(raw), formatted: normalize(it.formatted_text)});
    }
  }
}
fs.writeFileSync('documents/formatting-discrepancies.json', JSON.stringify(out,null,1));
console.log(out.length);
