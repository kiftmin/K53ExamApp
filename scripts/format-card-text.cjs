// Formats rule/sign card text using the Gemini API with the UX-copywriter
// prompt. Run once: node scripts/format-card-text.cjs
// Requires GEMINI_API_KEY in .env.
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const AI_KEY = process.env.GEMINI_API_KEY;
if (!AI_KEY) {
  console.error('GEMINI_API_KEY is not set in .env');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const PROMPT = `You are an expert UX copywriter and data-transformation middleware for a K53 driver's license mobile app.

Formatting rules:
- Extract Lists: whenever the raw text contains multiple distinct points, conditions, scenarios, or actions, break them into a structured list using lowercase Roman numerals: (i), (ii), (iii).
- Group Related Concepts (do not over-split): keep closely related compound phrases (e.g. "disqualified or suspended", "narcotics or excessive alcohol") within the same list item.
- Line breaks: each roman numeral point MUST be placed on a new line. Include an introductory clause before the list starts.
- Bold Keywords: bold the most critical keywords, triggers, or core concepts (1-3 most vital phrases per point) using Markdown **.

Return ONLY the formatted text, nothing else. No preamble, no explanation.

Example:
Raw: "A person is disqualified from obtaining or holding a licence while addicted to narcotics or excessive alcohol use, while disqualified or suspended by a court or authority, or during a period following cancellation of a previous licence."
Formatted: "A person is disqualified from obtaining or holding a licence:
(i) while **addicted to narcotics or excessive alcohol** use,
(ii) while **disqualified or suspended** by a court or authority, or
(iii) during a period **following cancellation** of a previous licence."

Now format this text:

`;

async function formatWithGemini(raw) {
  let attempt = 0;
  for (;;) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${AI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT + raw }] }] }),
        }
      );
      if (res.status === 503 || res.status === 429) {
        attempt++;
        if (attempt > 5) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    } catch (e) {
      attempt++;
      if (attempt > 5) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function* eachRow(query) {
  const rows = await sql.query(query).then((r) => r.rows ?? r);
  for (const row of rows) yield row;
}

async function main() {
  let n = 0;
  for await (const r of eachRow(`SELECT id, body FROM study_rules WHERE body NOT LIKE '%**%' AND body NOT LIKE '%(i)%'`)) {
    const out = await formatWithGemini(r.body);
    if (out) {
      await sql.query(`UPDATE study_rules SET body = '${out.replace(/'/g, "''")}' WHERE id = ${r.id}`);
      n++;
      if (n % 10 === 0) console.log('rules formatted:', n);
    }
    await new Promise((r) => setTimeout(r, 300)); // rate-limit courtesy
  }
  console.log('rules done:', n);

  n = 0;
  for await (const s of eachRow(`SELECT id, where_text, purpose_text, action_text FROM study_signs WHERE action_text NOT LIKE '%**%' AND action_text NOT LIKE '%(i)%'`)) {
    const setters = [];
    if (s.where_text) setters.push(['where_text', await formatWithGemini(s.where_text)]);
    if (s.purpose_text) setters.push(['purpose_text', await formatWithGemini(s.purpose_text)]);
    if (s.action_text) setters.push(['action_text', await formatWithGemini(s.action_text)]);
    for (const [col, out] of setters) {
      await sql.query(`UPDATE study_signs SET ${col} = '${(out ?? '').replace(/'/g, "''")}' WHERE id = ${s.id}`);
    }
    n++;
    if (n % 10 === 0) console.log('signs formatted:', n);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log('signs done:', n);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
