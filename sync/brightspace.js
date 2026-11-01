// Run in a Brightspace (D2L) tab where you are already signed in, e.g. https://<your-school>.brightspace.com/d2l/home
// Returns {courses, items}: assignments (with your submission status), quizzes and calendar events
// from 14 days ago to 120 days ahead, for courses that are currently active.
// Course codes are parsed from the org unit code (pattern like ..._DS-UA_202_...); adjust COURSE_RE for your school.
const COURSE_RE = /_([A-Z]+-[A-Z]+)_(\d+)_/;
const now = new Date();
const from = new Date(now.getTime() - 14*864e5).toISOString();
const to = new Date(now.getTime() + 120*864e5).toISOString();
const enr = await fetch('/d2l/api/lp/1.43/enrollments/myenrollments/?orgUnitTypeId=3&isActive=true').then(r=>r.json());
const courses = enr.Items.filter(i => i.Access.CanAccess && i.Access.EndDate && new Date(i.Access.EndDate) > now && (!i.Access.StartDate || new Date(i.Access.StartDate) < new Date(now.getTime()+30*864e5)))
  .map(i => { const m = i.OrgUnit.Code.match(COURSE_RE); return {ou:i.OrgUnit.Id, course: m ? `${m[1]} ${m[2]}` : i.OrgUnit.Name}; });
const items = []; const seen = new Set();
const add = it => { const k = it.course+'|'+it.name.toLowerCase()+'|'+it.due.slice(0,10); if (!seen.has(k)) { seen.add(k); items.push(it); } };
for (const {ou, course} of courses){
  const folders = await fetch(`/d2l/api/le/1.67/${ou}/dropbox/folders/`).then(r=>r.ok?r.json():[]).catch(()=>[]);
  for (const f of folders){
    const due = f.DueDate || f.Availability?.EndDate; if (!due) continue;
    const mine = await fetch(`/d2l/api/le/1.67/${ou}/dropbox/folders/${f.Id}/submissions/mysubmissions/`).then(r=>r.ok?r.json():[]).catch(()=>[]);
    const submitted = (Array.isArray(mine) ? mine : []).some(e => (e.Submissions || []).length > 0);
    add({source:'brightspace', course, name:f.Name, due, kind:'assignment', status: submitted ? 'submitted' : '', url:`${location.origin}/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${f.Id}&ou=${ou}`});
  }
  const qz = await fetch(`/d2l/api/le/1.67/${ou}/quizzes/`).then(r=>r.ok?r.json():{Objects:[]}).catch(()=>({Objects:[]}));
  for (const q of (qz.Objects||[])){ const due = q.DueDate || q.EndDate; if (due) add({source:'brightspace', course, name:q.Name, due, kind:'quiz', status:'', url:`${location.origin}/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${ou}`}); }
  const cal = await fetch(`/d2l/api/le/1.67/${ou}/calendar/events/myEvents/?startDateTime=${from}&endDateTime=${to}`).then(r=>r.ok?r.json():[]).catch(()=>[]);
  for (const e of (cal.Objects || cal || [])){ const due = e.EndDateTime || e.StartDateTime; if (due && e.Title) add({source:'brightspace', course, name:e.Title, due, kind: /quiz/i.test(e.Title)?'quiz':/exam|midterm|final/i.test(e.Title)?'exam':'assignment', status:'', url:`${location.origin}/d2l/le/calendar/${ou}/event/${e.CalendarEventId}/detailsview`}); }
}
({courses: courses.map(c=>c.course), items: items.filter(i => i.due >= from && i.due <= to)})
