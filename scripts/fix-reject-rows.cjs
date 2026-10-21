// Restores the last 10 rows where Gemini silently corrected grammar/punctuation.
// Each entry is an exact-string replacement inside formatted_text; insert-only changes
// (** and line markers/newlines) are preserved.
const fs = require('fs');
const path = require('path');

const FILES = {
  'study_rules|body': 'documents/formatted-rules-body.json',
  'study_signs|where_text': 'documents/formatted-signs-where.json',
  'study_signs|purpose_text': 'documents/formatted-signs-purpose.json',
  'study_signs|action_text': 'documents/formatted-signs-action.json',
};

const fixes = [
  { table: 'study_rules', field: 'body', id: 146,
    text: "(i) **Don't give a hand signal on a freeway** (except for reasons beyond your control),\n(ii) **be on a freeway on foot**, or\n(iii) **leave an animal** where it could stray onto one." },
  { table: 'study_signs', field: 'where_text', id: 140,
    from: 'On any public road, **especially in mountainous areas**.', to: 'On any public road **especially in mountainous areas**.' },
  { table: 'study_signs', field: 'where_text', id: 141,
    from: 'On any public road, **especially in mountainous areas**.', to: 'On any public road **especially in mountainous areas**.' },
  { table: 'study_signs', field: 'where_text', id: 142,
    from: 'On any public road, **especially in mountainous areas**.', to: 'On any public road **especially in mountainous areas**.' },
  { table: 'study_signs', field: 'where_text', id: 147,
    from: '**before an intersection with traffic light**', to: '**before a intersection with traffic light**' },
  { table: 'study_signs', field: 'where_text', id: 148,
    from: '**before an intersection with a stop sign**', to: '**before a intersection with a stop sign**' },
  { table: 'study_signs', field: 'where_text', id: 150,
    text: 'On any road **but especially in rural areas near schools**.' },
  { table: 'study_signs', field: 'where_text', id: 152,
    from: 'On any road, **especially in rural areas**.', to: 'On any road **especially in rural areas**.' },
  { table: 'study_signs', field: 'purpose_text', id: 78,
    from: '**overall width of the vehicle** is less than the width indicated in metres by means',
    to: '**overall width of the vehicle**, is less than the width indicated in metres, by means' },
  { table: 'study_signs', field: 'action_text', id: 204,
    from: '**Look out for additional regulatory signs**', to: '**Look out for a additional regulatory signs**' },
];

const loaded = {};
for (const [key, file] of Object.entries(FILES)) loaded[key] = JSON.parse(fs.readFileSync(file, 'utf8'));

let done = 0;
for (const f of fixes) {
  const key = `${f.table}|${f.field}`;
  const item = loaded[key].find((x) => x.id === f.id);
  if (!item) { console.log('MISSING', key, f.id); continue; }
  if (f.text != null) {
    item.formatted_text = f.text;
    done++;
    continue;
  }
  if (!item.formatted_text.includes(f.from)) {
    if (item.formatted_text.includes(f.to)) { done++; continue; }
    console.log('NO MATCH', key, f.id); continue;
  }
  item.formatted_text = item.formatted_text.replace(f.from, f.to);
  done++;
}

for (const [key, file] of Object.entries(FILES)) fs.writeFileSync(file, JSON.stringify(loaded[key], null, 1));
fs.writeFileSync(path.join('documents', 'batches', 'manual-fixes.json'), JSON.stringify(fixes, null, 1));
console.log(`applied ${done}/${fixes.length} manual repairs`);
