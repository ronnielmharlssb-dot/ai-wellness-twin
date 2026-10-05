const test=require('node:test');
const assert=require('node:assert/strict');
const {createLoader,memoryStorage}=require('./load-typescript.cjs');
const {IDBFactory}=require('fake-indexeddb');
const {webcrypto}=require('node:crypto');
const A='00000000-0000-4000-8000-000000000001';
function fixture(upload, preferences) {
  const storage=memoryStorage();
  const user={id:A,source:'supabase',role:'employee'};
  const requests=[];
  const load=createLoader({indexedDB:new IDBFactory(),crypto:webcrypto,AbortController,localStorage:storage,window:{dispatchEvent:()=>{}},
    CustomEvent:class{constructor(type){this.type=type;}},fetch:async(url,init)=>{
      const input=JSON.parse(init.body);requests.push({url,input});return upload(input,user);
    }},{'../supabase/auth':{getLocalSessionUser:()=>user},
    '../settings/userSettings':{getUserSettings:()=>preferences??({twin:{workdayStart:'09:00',workdayEnd:'18:00'}})}});
  return {load,user,requests,storage,sync:load('src/lib/integrations/syncEngine.ts').syncProvider};
}
const end=new Date(Date.now()-1000).toISOString();
const config={calendarEmail:'employee@example.com',calendarEvents:[],
  calendarCoverage:{start:new Date(Date.parse(end)-86400000).toISOString(),end}};
test('manual cloud calendar sync caches only acknowledged snapshots and uses the actual coverage capture time',async()=>{
  const f=fixture(async(input)=>({ok:true,json:async()=>({success:true,dailyMetrics:input.snapshots.map(snapshot=>({
    ...snapshot,cloudRevision:1,telemetryRevision:null,contributions:{google_calendar:snapshot},toolActiveMinutes:{},githubEventCount:null,
  }))})}));
  const result=await f.sync('google_calendar',A,config);
  assert.equal(result.success,true);
  assert.equal(f.requests[0].url,'/api/telemetry/source-snapshots');
  assert.equal(f.requests[0].input.capturedAt,config.calendarCoverage.end);
  const metrics=f.load('src/lib/wellbeing/employeeMetrics.ts').getEmployeeMetrics();
  assert.equal(metrics.length,result.daysSynced);
  assert.equal(metrics.every(m=>m.cloudRevision===1),true);
  assert.equal(metrics.every(m=>m.observedMetrics.length===2),true);
});
test('a failed cloud import stays queued without saving draft metrics or reporting a completed sync',async()=>{
  const f=fixture(async()=>({ok:false,status:503,json:async()=>({success:false})}));
  const result=await f.sync('google_calendar',A,config);
  assert.equal(result.pending,true);
  assert.equal(result.daysSynced,0);
  assert.equal(f.load('src/lib/wellbeing/employeeMetrics.ts').getEmployeeMetrics().length,0);
  assert.equal(f.load('src/lib/integrations/syncEngine.ts').getStoredIntegrations(A).find(c=>c.provider==='google_calendar').dataStatus,'pending');
  const queued=await f.load('src/lib/integrations/sourceImportStore.ts').listSourceImports(A);
  assert.equal(queued.length,1);
  assert.equal(queued[0].capturedAt,config.calendarCoverage.end);
});
test('account changes during a source upload prevent its reply from entering the display cache',async()=>{
  const f=fixture(async(input,user)=>{
    user.id='another-account';
    return {ok:true,json:async()=>({success:true,dailyMetrics:[]})};
  });
  await assert.rejects(()=>f.sync('google_calendar',A,config),/account changed/);
  assert.equal(f.load('src/lib/wellbeing/employeeMetrics.ts').getEmployeeMetrics().length,0);
});
test('manual calendar imports preserve the account preference to leave after-hours unobserved',async()=>{
  const f=fixture(async input=>({ok:true,json:async()=>({success:true,dailyMetrics:input.snapshots.map(snapshot=>({
    ...snapshot,cloudRevision:1,telemetryRevision:null,contributions:{google_calendar:snapshot},toolActiveMinutes:{},githubEventCount:null,
  }))})}),{profile:{timezone:'Asia/Singapore'},twin:{workdayStart:'09:00',workdayEnd:'18:00',workDays:['Mon','Tue','Wed','Thu','Fri']},
    telemetry:{autoCaptureAfterHours:false}});
  const result=await f.sync('google_calendar',A,config);
  assert.equal(result.success,true);
  assert.equal(f.requests[0].input.snapshots.every(snapshot=>snapshot.observedMetrics.length===1&&snapshot.observedMetrics[0]==='meetingLoad'),true);
  const metrics=f.load('src/lib/wellbeing/employeeMetrics.ts').getEmployeeMetrics();
  assert.equal(metrics.every(metric=>!metric.observedMetrics.includes('afterHoursActivity')),true);
});
