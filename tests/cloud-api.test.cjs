const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoader, memoryStorage, plain } = require('./load-typescript.cjs');
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const numbers={workingHours:1,meetingLoad:0,breakFrequency:0,afterHoursActivity:0,observedMetrics:['workingHours','breakFrequency','afterHoursActivity']};
const metric={...numbers,employeeId:A,date:new Date().toISOString().slice(0,10),source:'telemetry',
  cloudRevision:1,telemetryRevision:1,contributions:{telemetry:numbers},toolActiveMinutes:{workstation:60},githubEventCount:null};
function fixture() {
  let result={data:{dailyMetrics:[metric],lastHeartbeat:new Date().toISOString(),stateRevision:1},error:null};
  const calls=[];
  const user={id:A,role:'employee',source:'supabase'};
  const auth={getAuthenticatedUser:async()=>user,isSameOriginRequest:r=>r.headers.get('origin')===new URL(r.url).origin};
  const file={recordLiveHeartbeat:()=>{throw new Error('Cloud writes must not use files');},
    getLastHeartbeat:()=>{throw new Error('Cloud reads must not use files');},getServerMetricsStore:()=>{throw new Error('Cloud reads must not use files');}};
  const load=createLoader({console:{...console,error:()=>{}}},{
    '../supabase/server':{createClient:async()=>({rpc:(name,args)=>({abortSignal:async()=>{calls.push({name,args});return result;}})})},
    '../supabase/serverAuth':auth,'@/lib/supabase/serverAuth':auth,
    './telemetryAggregator':file,'@/lib/telemetry/telemetryAggregator':file,
  });
  const request=body=>new Request('http://localhost/api/telemetry/heartbeat',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify(body)});
  const packet={eventId:'retry-id',employeeId:A,organizationId:'personal:'+A,timestamp:new Date().toISOString(),
    activeSeconds:45,meetingMinutes:0,isBreak:false,isEvening:false,source:'workstation'};
  return {load,user,calls,request,packet,setResult:next=>{result=next;}};
}
test('cloud uploads only acknowledge validated committed RPC responses; errors never fall back to files',async()=>{
  const f=fixture();
  const ingest=f.load('src/lib/telemetry/ingestRequest.ts').ingestTelemetryRequest;
  const success=await ingest(f.request(f.packet));
  assert.equal(success.status,200);
  assert.equal((await success.json()).summary.todayActiveMinutes,60);
  assert.equal(f.calls[0].name,'record_wellness_heartbeat');
  assert.equal(f.calls[0].args.event.eventId,'retry-id');
  for(const [code,status] of [['23505',409],['22023',400],['22008',400],['23514',422],['42501',403],['PGRST202',503]]) {
    f.setResult({data:null,error:{code}});
    assert.equal((await ingest(f.request(f.packet))).status,status);
  }
  f.setResult({data:{dailyMetrics:[{...metric,employeeId:B}],lastHeartbeat:new Date().toISOString()},error:null});
  assert.equal((await ingest(f.request(f.packet))).status,503);
});
test('private history and live status read cloud snapshots and enforce employee scope',async()=>{
  const f=fixture();
  const history=f.load('src/app/api/telemetry/history/route.ts').GET;
  const status=f.load('src/app/api/telemetry/live-status/route.ts').GET;
  let response=await history();
  assert.equal(response.status,200);
  assert.equal((await response.json()).dailyMetrics[0].employeeId,A);
  response=await status(new Request('http://localhost/api/telemetry/live-status'));
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,'connected');
  assert.equal((await status(new Request('http://localhost/api/telemetry/live-status?employeeId='+B))).status,403);
  f.setResult({data:null,error:{code:'PGRST202'}});
  assert.equal((await history()).status,503);
  assert.equal((await status(new Request('http://localhost/api/telemetry/live-status'))).status,503);
  f.user.role='hr';
  assert.equal((await history()).status,403);
});
test('source snapshot API rejects oversized or unexpected payloads and maps database rejections',async()=>{
  const f=fixture();
  const post=f.load('src/app/api/telemetry/source-snapshots/route.ts').POST;
  const input={snapshots:[],capturedAt:new Date().toISOString()};
  assert.equal((await post(f.request(input))).status,200);
  assert.equal(f.calls[0].name,'import_wellness_snapshots');
  assert.equal((await post(f.request({...input,content:'private'}))).status,400);
  assert.equal((await post(f.request({...input,snapshots:Array(37).fill({})}))).status,400);
  assert.equal((await post(f.request({...input,snapshots:[{content:'x'.repeat(17000)}]}))).status,413);
  const snapshot={...numbers,employeeId:A,date:metric.date,source:'google_calendar',workingHours:0,observedMetrics:['meetingLoad','afterHoursActivity']};
  const calls=f.calls.length;
  assert.equal((await post(f.request({...input,snapshots:[{...snapshot,content:'private'}]}))).status,400);
  assert.equal((await post(f.request({...input,snapshots:[{...snapshot,employeeId:B}]}))).status,403);
  assert.equal(f.calls.length,calls);
  f.setResult({data:null,error:{code:'23505'}});
  assert.equal((await post(f.request(input))).status,409);
});
test('full cloud snapshots replace legacy estimates and allow corrections while stale replies cannot regress history',()=>{
  const storage=memoryStorage();
  const load=createLoader({window:{},localStorage:storage});
  const {saveEmployeeMetricsBatch,replaceCloudEmployeeMetrics,getEmployeeMetrics}=load('src/lib/wellbeing/employeeMetrics.ts');
  const {decodeCloudMetrics}=load('src/lib/wellbeing/observationCodec.ts');
  saveEmployeeMetricsBatch([{...metric,contributions:undefined,cloudRevision:undefined,source:'demo',workingHours:8},
    {...metric,employeeId:B,contributions:undefined,cloudRevision:undefined,source:'demo',workingHours:9}]);
  replaceCloudEmployeeMetrics(A,decodeCloudMetrics([metric],A));
  assert.equal(getEmployeeMetrics().find(m=>m.employeeId===A).workingHours,1);
  assert.equal(getEmployeeMetrics().find(m=>m.employeeId===B).workingHours,9);
  const corrected={...metric,meetingLoad:0.5,cloudRevision:3};
  saveEmployeeMetricsBatch([corrected]);
  saveEmployeeMetricsBatch([{...metric,meetingLoad:4,cloudRevision:2}]);
  assert.equal(getEmployeeMetrics().find(m=>m.employeeId===A).meetingLoad,0.5);
  saveEmployeeMetricsBatch([{...metric,cloudRevision:undefined,workingHours:10}]);
  assert.equal(getEmployeeMetrics().find(m=>m.employeeId===A).workingHours,1);
  for(const bad of [{...metric,employeeId:B},{...metric,workingHours:Infinity},{...metric,cloudRevision:1.1},
    {...metric,date:'2026-02-30'},{...metric,source:'demo'},{...metric,observedMetrics:['invented']}]) {
    assert.throws(()=>decodeCloudMetrics([bad],A));
  }
  assert.throws(()=>decodeCloudMetrics([metric,metric],A));
  const future={...metric,date:'2026-10-02',cloudRevision:4};
  saveEmployeeMetricsBatch([future]);
  replaceCloudEmployeeMetrics(A,[metric],1);
  assert.equal(getEmployeeMetrics().find(m=>m.date===future.date && m.employeeId===A).cloudRevision,4);
  assert.deepEqual(plain(decodeCloudMetrics([metric],A)[0].contributions.telemetry),numbers);
});
