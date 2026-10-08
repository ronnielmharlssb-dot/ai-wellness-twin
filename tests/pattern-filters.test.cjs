const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./load-typescript.cjs');

test('every pattern category displays the current recorded metric instead of obsolete names', () => {
  const load = createLoader();
  const now = Date.parse('2026-10-08T12:00:00Z');
  const end = Date.parse('2026-10-08T00:00:00Z');
  const metrics = Array.from({length:35}, (_,i) => ({
    employeeId:'fixture',date:new Date(end-(i+1)*86400000).toISOString().slice(0,10),source:'telemetry',
    workingHours:i<7?12:8,meetingLoad:i<7?4:2,breakFrequency:i<7?2:4,afterHoursActivity:i<7?20:10,
    observedMetrics:['workingHours','meetingLoad','breakFrequency','afterHoursActivity'],
  }));
  const assessment = load('src/lib/wellbeing/employeeAssessment.ts').buildEmployeeAssessment(metrics,{now});
  assert.equal(assessment.changes.length,4);
  for (const [tab,label] of [['focus','Recorded Active Time'],['meetings','Scheduled Meeting Load'],['boundaries','Recorded After-hours Activity'],['breaks','Recorded Breaks']]) {
    const renderLoader = createLoader({}, {
      react:{...React,useState:()=>[tab,()=>{}]},
      '@/components/use-employee-assessment':{useEmployeeAssessment:()=>assessment},
    });
    const html = renderToStaticMarkup(React.createElement(renderLoader('src/app/dashboard/patterns/page.tsx').default));
    const category = html.slice(html.indexOf('Observed Pattern Metrics'));
    assert.match(category,/1 dimensions/);
    assert.ok(category.includes(label),tab+' must show its recorded metric');
    assert.equal((category.match(/At least 20% recorded shift/g)||[]).length,1);
  }
});
