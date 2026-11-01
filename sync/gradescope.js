// Run in a https://www.gradescope.com tab where you are already signed in.
// Returns {term, courses, items} for the most recent term on your account page,
// with submission status and scores ("graded 39.0 / 40.0").
const acct = new DOMParser().parseFromString(await fetch('/account').then(r=>r.text()), 'text/html');
const terms = [...acct.querySelectorAll('.courseList--term')].map(t => t.innerText.trim());
const current = terms[0];
const boxes = [...acct.querySelectorAll('a.courseBox')].filter(a => (a.closest('.courseList--coursesForTerm')?.previousElementSibling?.innerText || '').trim() === current);
const courseCode = (s, n) => { const m = (s + ' ' + n).match(/([A-Z]{2,5})-([A-Z]{2})[\s_]+(\d{3})/); return m ? `${m[1]}-${m[2]} ${m[3]}` : s; };
const items = [], courses = [];
for (const a of boxes){
  const course = courseCode(a.querySelector('.courseBox--shortname')?.innerText || '', a.querySelector('.courseBox--name')?.innerText || '');
  courses.push(course);
  const href = a.getAttribute('href');
  const doc = new DOMParser().parseFromString(await fetch(href).then(r=>r.text()), 'text/html');
  for (const tr of doc.querySelectorAll('#assignments-student-table tbody tr')){
    const th = tr.querySelector('th'); if (!th) continue;
    const name = th.innerText.trim();
    const link = th.querySelector('a[href]')?.getAttribute('href') || th.querySelector('button[data-post-url]')?.getAttribute('data-post-url') || href;
    const dueEl = tr.querySelector('.submissionTimeChart--dueDate');
    const dueRaw = dueEl?.getAttribute('datetime') || dueEl?.innerText || '';
    const due = dueRaw ? new Date(dueRaw.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')) : null;
    if (!due || isNaN(due)) continue;
    const statusText = (tr.querySelector('.submissionStatus--text')?.innerText || tr.querySelector('.submissionStatus')?.innerText || tr.querySelectorAll('td')[0]?.innerText || '').replace(/\s+/g,' ').trim();
    const graded = /^\d+(\.\d+)?\s*\/\s*\d+/.test(statusText);
    const status = graded ? `graded ${statusText}` : /submitted/i.test(statusText) ? 'submitted' : '';
    items.push({source:'gradescope', course, name, due: due.toISOString(), kind: /quiz/i.test(name) ? 'quiz' : /exam|midterm|final/i.test(name) ? 'exam' : 'assignment', status, note: status ? '' : (/no submission/i.test(statusText) ? 'not submitted' : ''), url: 'https://www.gradescope.com' + (link.startsWith('/') ? link : href)});
  }
}
({term: current, courses, items})
