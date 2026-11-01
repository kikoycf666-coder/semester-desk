// Run in a PrairieLearn tab where you are already signed in (e.g. https://us.prairielearn.com/pl).
// Returns {courses, items}. Lettered practice variants (HW1A, HW1B…) are skipped, and 4+ items in one
// section that share a deadline are collapsed into one "N of M not finished" line.
const home = new DOMParser().parseFromString(await fetch('/pl').then(r=>r.text()), 'text/html');
const cis = [...home.querySelectorAll('a')].filter(a => /\/pl\/course_instance\/\d+$/.test(a.getAttribute('href')||'')).map(a => ({href:a.getAttribute('href'), title:a.textContent.trim()}));
const now = new Date(); const MONTHS = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
const parseUntil = s => { const m = s.match(/until\s+(\d{1,2}):(\d{2}),\s*\w{3},\s*(\w{3})\s+(\d{1,2})/); if (!m) return null;
  let y = now.getFullYear(); const mo = MONTHS[m[3]]; if (mo < now.getMonth() - 6) y++;
  return new Date(y, mo, +m[4], +m[1], +m[2]).toISOString(); };
const items = [], courses = [];
for (const ci of cis){
  const cm = ci.title.match(/(CS|CSCI)[-\s]?(?:UA\s*)?(\d{3})/i); const course = cm ? `CSCI-UA ${cm[2]}` : ci.title.split('~')[0].trim();
  courses.push(course);
  const doc = new DOMParser().parseFromString(await fetch(ci.href + '/assessments').then(r=>r.text()), 'text/html');
  let section = ''; const rows = [];
  for (const tr of doc.querySelectorAll('table tr')){
    const cells = [...tr.querySelectorAll('th,td')].map(c => c.innerText.replace(/\s+/g,' ').trim());
    if (cells.length === 1 && cells[0]) { section = cells[0]; continue; }
    if (cells.length < 4 || cells[0] === 'Label') continue;
    if (/^HW\d+[A-Z]$/i.test(cells[0])) continue; // lettered variants are ungraded practice
    const due = parseUntil(cells[2]); if (!due) continue;
    const score = cells[3]; const done = /^100%$/.test(score);
    const a = tr.querySelector('a'); const url = a ? location.origin + a.getAttribute('href') : '';
    rows.push({section, label:cells[0], title:cells[1], due, score, done, url});
  }
  const groups = {};
  for (const r of rows) (groups[r.section + '|' + r.due] ||= []).push(r);
  for (const g of Object.values(groups)){
    const open = g.filter(r => !r.done);
    if (g.length >= 4){
      if (!open.length) continue;
      items.push({source:'prairielearn', course, name:`${g[0].section}: ${open.length} of ${g.length} not finished`, due:g[0].due, kind:'assignment', status:'', note: open.slice(0,4).map(r=>r.label).join(', ') + (open.length>4?'…':''), url: location.origin + ci.href + '/assessments'});
    } else for (const r of g){
      items.push({source:'prairielearn', course, name:`${r.label} · ${r.title}`, due:r.due, kind: /quiz|exam/i.test(r.section + r.title) ? (/exam/i.test(r.title)?'exam':'quiz') : 'assignment', status: r.done ? 'complete' : '', note: r.done ? '' : (/^\d+%$/.test(r.score) ? `score ${r.score}` : r.score.toLowerCase()), url:r.url});
    }
  }
}
({courses, items})
