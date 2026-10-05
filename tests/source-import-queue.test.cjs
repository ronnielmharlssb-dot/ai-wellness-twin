const test=require('node:test');
const assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
const {webcrypto}=require('node:crypto');
const {createLoader,memoryStorage,plain}=require('./load-typescript.cjs');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const captured=new Date(Date.now()-1000).toISOString();
const snapshot={employeeId:A,date:captured.slice(0,10),source:'google_calendar',workingHours:0,meetingLoad:1,
  breakFrequency:0,afterHoursActivity:0,observedMetrics:['meetingLoad','afterHoursActivity']};
const rows=input=>input.snapshots.map(s=>({...s,cloudRevision:1,contributions:{[s.source]:s},toolActiveMinutes:{},telemetryRevision:null,githubEventCount:null}));
function fixture(t,upload=async input=>({ok:true,json:async()=>({success:true,dailyMetrics:rows(input)})}),overrides={}) {
  const database=new IDBFactory(), storage=memoryStorage();
  const user={id:A,role:'employee',source:'supabase'};
  const events=new Map();
  const window={dispatchEvent:()=>{},addEventListener:(name,callback)=>events.set(name,callback),removeEventListener:name=>events.delete(name)};
  const calls=[];
  const globals={indexedDB:database,crypto:webcrypto,AbortController,localStorage:storage,window,
    setInterval:()=>1,clearInterval:()=>{},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
    fetch:async(url,init)=>{const input=JSON.parse(init.body);calls.push(input);return upload(input,user,init);}};
  const dependencies={'../supabase/auth':{getLocalSessionUser:()=>user},...overrides};
  const load=createLoader(globals,dependencies);
  const Queue=load('src/lib/integrations/sourceImportQueue.ts').SourceImportQueue;
  const queue=new Queue();
  t.after(()=>queue.stop());
  return {database,storage,user,events,calls,globals,dependencies,load,queue,
    store:load('src/lib/integrations/sourceImportStore.ts'),snapshot,captured,
    reload:()=>{const next=createLoader(globals,dependencies);return {queue:new(next('src/lib/integrations/sourceImportQueue.ts').SourceImportQueue)(),load:next};}};
}
test('network failures survive module reloads and retry identical captures before entering assessment',async t=>{
  let working=false;
  const f=fixture(t,async input=>working?{ok:true,json:async()=>({success:true,dailyMetrics:rows(input)})}:{ok:false,status:503});
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  assert.equal(await f.queue.upload(A,id),'pending');
  assert.equal(f.load('src/lib/wellbeing/employeeMetrics.ts').getEmployeeMetrics().length,0);
  assert.equal((await f.store.listSourceImports(A))[0].attempts,1);
  const next=f.reload();
  t.after(()=>next.queue.stop());
  await f.store.retrySourceImports(A);
  working=true;
  assert.equal(await next.queue.upload(A,id),'synced');
  assert.deepEqual(plain(f.calls[0]),plain(f.calls[1]));
  const receipt=(await f.store.listSourceImports(A))[0];
  assert.equal(receipt.status,'acknowledged');
  assert.deepEqual(receipt.snapshots,[]);
  assert.equal((await next.queue.getRejected(A)).length,0);
  assert.equal(next.load('src/lib/wellbeing/employeeMetrics.ts').getEmployeeMetrics()[0].cloudRevision,1);
});
test('concurrent transactions preserve both batches and grant only one active lease per batch',async t=>{
  const f=fixture(t);
  const ids=await Promise.all([f.queue.enqueue(A,'google_calendar',[snapshot],captured),f.queue.enqueue(A,'google_calendar',[snapshot],captured)]);
  assert.equal((await f.store.listSourceImports(A)).length,2);
  const claims=await Promise.all([f.store.claimSourceImport(A,'tab-one',Date.now(),ids[0]),f.store.claimSourceImport(A,'tab-two',Date.now(),ids[0])]);
  assert.equal(claims.filter(Boolean).length,1);
  assert.equal(await f.store.settleSourceImport(A,ids[0],'not-the-owner',{status:'acknowledged'}),false);
  assert.equal(await f.store.claimSourceImport(B,'other-user',Date.now(),ids[1]),null);
  assert.deepEqual(await f.store.listSourceImports(B),[]);
});
test('expired tab leases are recoverable and changed accounts cannot consume acknowledgements',async t=>{
  const f=fixture(t,async(input,user)=>{user.id=B;return {ok:true,json:async()=>({success:true,dailyMetrics:rows(input)})};});
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  await f.store.claimSourceImport(A,'closed-tab',Date.now()-61000,id);
  assert.equal(await f.queue.upload(A,id),'pending');
  assert.equal(f.load('src/lib/wellbeing/employeeMetrics.ts').getEmployeeMetrics().length,0);
  assert.equal((await f.store.listSourceImports(A)).length,1);
  await assert.rejects(()=>f.queue.upload(A,id),/account changed/);
  await assert.rejects(()=>f.queue.getRejected(A),/account changed/);
});
test('permanent rejections are retained for review and do not block a newer import',async t=>{
  let attempts=0;
  const f=fixture(t,async input=>++attempts===1?{ok:false,status:409}:{ok:true,json:async()=>({success:true,dailyMetrics:rows(input)})});
  const first=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  assert.equal(await f.queue.upload(A,first),'needs_review');
  const second=await f.queue.enqueue(A,'google_calendar',[snapshot],new Date(Date.parse(captured)+500).toISOString());
  assert.equal(await f.queue.upload(A,second),'synced');
  const rejected=await f.queue.getRejected(A);
  assert.equal(rejected.length,1);
  assert.equal(rejected[0].id,first);
  assert.equal(rejected[0].reason.includes('409'),true);
});
test('expired and corrupted saved metadata is quarantined without a network request',async t=>{
  const f=fixture(t);
  const old=new Date(Date.now()-36*86400000).toISOString();
  await f.store.saveSourceImport({version:1,id:'expired',employeeId:A,provider:'google_calendar',capturedAt:old,enqueuedAt:old,
    snapshots:[{...snapshot,date:old.slice(0,10)}],status:'pending',attempts:0,nextAttemptAt:0});
  assert.equal(await f.queue.upload(A,'expired'),'needs_review');
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  const saved=(await f.store.listSourceImports(A)).find(item=>item.id===id);
  await f.store.cancelSourceImports(A,'google_calendar');
  // Use a distinct corrupted record, preserving its raw payload for review.
  await f.store.saveSourceImport({...saved,id:'corrupt',status:'pending',snapshots:[{...snapshot,employeeId:B}]});
  assert.equal(await f.queue.upload(A,'corrupt'),'needs_review');
  assert.equal(f.calls.length,0);
  assert.equal((await f.queue.getRejected(A)).some(item=>item.id==='corrupt'),true);
});
test('incomplete acknowledgements and auth errors retain batches for retry',async t=>{
  let response={ok:true,json:async()=>({success:true,dailyMetrics:[]})};
  const f=fixture(t,async()=>response);
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  assert.equal(await f.queue.upload(A,id),'pending');
  assert.equal((await f.store.listSourceImports(A)).length,1);
  for(const status of [401,403,429]) {
    response={ok:false,status};await f.store.retrySourceImports(A);
    assert.equal(await f.queue.upload(A,id),'pending');
    assert.equal((await f.store.listSourceImports(A))[0].status,'pending');
  }
});
test('unlink cancels queued uploads while retaining their observations for review',async t=>{
  const f=fixture(t);
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  await f.queue.cancelProvider(A,'google_calendar');
  assert.equal(await f.queue.upload(A,id),'needs_review');
  assert.equal(f.calls.length,0);
  assert.equal((await f.queue.getRejected(A))[0].reason.includes('unlinked'),true);
});
test('failed device writes keep imports in memory and explicitly distinguish them from persisted batches',async t=>{
  let fail=true;
  const stored=new Map();
  const f=fixture(t,undefined,{'./sourceImportStore':{
    saveSourceImport:async batch=>{if(fail)throw new Error('Quota exceeded');stored.set(batch.id,batch);},
    listSourceImports:async()=>[...stored.values()],claimSourceImport:async()=>null,
  }});
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  assert.equal(f.queue.hasUnsavedImports(A),true);
  assert.equal(await f.queue.upload(A,id),'pending');
  assert.equal(f.calls.length,0);
  fail=false;
  await f.queue.upload(A,id);
  assert.equal(f.queue.hasUnsavedImports(A),false);
});
test('source validation excludes content, invented duration, invalid dates and wrong ownership before storage',()=>{
  const validate=createLoader()('src/lib/integrations/sourceSnapshotValidator.ts').validateSourceSnapshots;
  for(const bad of [{...snapshot,content:'private'},{...snapshot,workingHours:1},{...snapshot,employeeId:B},
    {...snapshot,meetingLoad:NaN},{...snapshot,date:'2026-02-30'},{...snapshot,githubEventCount:1}]) {
    assert.throws(()=>validate([bad],A,'google_calendar',captured));
  }
  assert.throws(()=>validate([snapshot,snapshot],A,'google_calendar',captured));
  assert.throws(()=>validate([snapshot],A,'invented',captured));
});
test('a missing queue entry cannot claim cloud success and the current capture can be saved again',async t=>{
  const f=fixture(t);
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  await new Promise((resolve,reject)=>{
    const request=f.database.open('wellness-source-imports',1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('batches','readwrite');tx.objectStore('batches').clear();
      tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};
    };
  });
  assert.equal(await f.queue.upload(A,id),'pending');
  assert.equal(f.queue.hasUnsavedImports(A),true);
  assert.equal(f.calls.length,0);
  assert.equal(await f.queue.upload(A,id),'synced');
  assert.equal(f.calls.length,1);
});
test('another tab can identify an acknowledged batch only from its committed receipt',async t=>{
  const f=fixture(t);
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  assert.equal(await f.queue.upload(A,id),'synced');
  const next=f.reload();t.after(()=>next.queue.stop());
  assert.equal(await next.queue.upload(A,id),'synced');
  assert.equal(f.calls.length,1);
  assert.equal(await next.queue.upload(A,'does-not-exist'),'pending');
});
test('an aborted acknowledgement transaction retains observations for a replay instead of inventing a receipt',async t=>{
  const f=fixture(t);
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  let abort=true;
  const open=f.database.open.bind(f.database);
  f.database.open=(...args)=>{
    const request=open(...args);
    request.addEventListener('success',()=>{
      const db=request.result,transaction=db.transaction.bind(db);
      db.transaction=(...args)=>{
        const tx=transaction(...args),objectStore=tx.objectStore.bind(tx);
        tx.objectStore=name=>{
          const store=objectStore(name),put=store.put.bind(store);
          store.put=(value,...args)=>{
            const request=put(value,...args);
            if(abort&&value.status==='acknowledged')request.addEventListener('success',()=>{abort=false;tx.abort();});
            return request;
          };
          return store;
        };
        return tx;
      };
    });
    return request;
  };
  assert.equal(await f.queue.upload(A,id),'pending');
  const pending=(await f.store.listSourceImports(A))[0];
  assert.equal(pending.status,'pending');
  assert.equal(pending.snapshots.length,1);
  assert.equal(pending.acknowledgedAt,undefined);
  await f.store.retrySourceImports(A);
  assert.equal(await f.queue.upload(A,id),'synced');
  assert.deepEqual(plain(f.calls[0]),plain(f.calls[1]));
});
test('the dashboard worker retries on connectivity recovery and stops when employee authority changes',async t=>{
  let working=false;
  const f=fixture(t,async input=>working?{ok:true,json:async()=>({success:true,dailyMetrics:rows(input)})}:{ok:false,status:503});
  const id=await f.queue.enqueue(A,'google_calendar',[snapshot],captured);
  assert.equal(await f.queue.upload(A,id),'pending');
  f.queue.start(A);await f.queue.flush();
  assert.equal(f.queue.getState().pending,1);
  working=true;f.events.get('online')();
  for(let i=0;i<50&&f.calls.length<2;i++)await new Promise(resolve=>setTimeout(resolve,5));
  for(let i=0;i<50&&f.queue.getState().pending>0;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(f.queue.getState().pending,0);
  assert.equal(f.calls.length,2);
  f.user.role='hr';f.events.get('wellness-auth-update')();
  assert.equal(f.queue.getState().employeeId,'');
  assert.equal(f.events.has('online'),false);
});
test('receipt cleanup removes only old acknowledgements for the current employee and preserves pending/rejected observations',async t=>{
  const f=fixture(t);
  const base={version:1,employeeId:A,provider:'google_calendar',capturedAt:captured,enqueuedAt:captured,snapshots:[],status:'acknowledged',attempts:0,nextAttemptAt:0};
  const old=new Date(Date.now()-36*86400000).toISOString();
  for(const batch of [{...base,id:'old',acknowledgedAt:old},{...base,id:'new',acknowledgedAt:captured},
    {...base,id:'other-owner',employeeId:B,acknowledgedAt:old},{...base,id:'pending',status:'pending',snapshots:[snapshot]},
    {...base,id:'rejected',status:'rejected',snapshots:[snapshot]}])await f.store.saveSourceImport(batch);
  await f.store.pruneSourceImportReceipts(A);
  assert.deepEqual((await f.store.listSourceImports(A)).map(b=>b.id).sort(),['new','pending','rejected']);
  assert.equal((await f.store.listSourceImports(B)).length,1);
});
test('the imports notice hides other accounts and distinguishes durable queues, memory-only failures and unreadable storage',()=>{
  const render=state=>{
    const load=createLoader({}, {'@/lib/integrations/sourceImportQueue':{sourceImportQueue:{getState:()=>state}}});
    return renderToStaticMarkup(React.createElement(load('src/components/ui/source-import-status.tsx').SourceImportStatus,{employeeId:A}));
  };
  const state={employeeId:A,pending:2,needsReview:0,inMemory:0,uploading:0,error:null};
  assert.equal(render({...state,employeeId:B}),'');
  assert.match(render(state),/2 imports are queued on this device/);
  assert.match(render({...state,inMemory:1}),/only held in memory/);
  assert.match(render({...state,inMemory:1}),/Keep this page open/);
  const error=render({...state,pending:0,error:'Device storage unavailable'});
  assert.match(error,/Import storage is currently unavailable/);
  assert.doesNotMatch(error,/0 imports need review/);
});
