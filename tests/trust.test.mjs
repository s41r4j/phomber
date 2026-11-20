import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile, writeFile, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../dist/workspace/index.js';
import {investigate, addFinding} from '../dist/core/engine.js';
import {contentHash, assessFinding, compareReports} from '../dist/core/trust.js';
import {HttpClient, retryAfter, SourceError} from '../dist/adapters/http.js';
import {collect, accountTasks} from '../dist/adapters/index.js';
import {DeepSeek, researchWithAI} from '../dist/ai/deepseek.js';
import {validateArticleSections} from '../dist/core/article.js';
import {writeReport} from '../dist/reports/html.js';
import {searchWorkspace} from '../dist/workspace/search.js';
import {startServer} from '../dist/server/index.js';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
async function base(t) {
  const root=await mkdtemp(join(tmpdir(),'phomber-trust-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const w=new Workspace(root);
  const inv=await investigate({schema_version:'1.0',subject:{name:'Test Researcher'},research:{offline:true}},w);
  const source={id:'s1',adapter:'fixture',url:'https://example.org/profile',retrieved_at:'2026-01-01T00:00:00Z',status:'ok'};
  source.snapshot_hash=await w.preserveSource(inv.id,{name:'Candidate Name'});
  inv.sources.push(source);
  addFinding(inv,{category:'identity',field:'name',value:'Candidate Name',identity:'candidate',excerpt:'Profile lists Candidate Name.'},source);
  await writeReport(inv,w);
  return {w,inv,f:inv.findings.find(f=>f.value==='Candidate Name')};
}

test('stable content hashes ignore property order without ignoring content changes',()=>{
  assert.equal(contentHash({z:1,a:{x:2,y:3}}),contentHash({a:{y:3,x:2},z:1}));
  assert.notEqual(contentHash({a:[1,2]}),contentHash({a:[2,1]}));
});
test('retrieval never establishes identity or credibility, nor automatic corroboration',async t=>{
  const {inv}=await base(t);
  for(const id of ['anchor-a','anchor-b']) {
    const s={id,adapter:id,url:`https://${id}.example.org/`,retrieved_at:inv.created_at,status:'ok'};
    inv.sources.push(s);addFinding(inv,{category:'identity',field:'company',value:'Example',identity:'anchored'},s);
  }
  const f=inv.findings.find(f=>f.field==='company');
  assert.equal(f.confidence.score,null);
  assert.notEqual(f.status,'corroborated');
  assert.deepEqual(assessFinding(inv,f),{extraction:'source-backed',identity:'supplied-resource',claim:'unassessed',review:'pending',stale_reviews:0});
});
test('equal candidate values from separate sources remain separate',async t=>{
  const {inv,f}=await base(t);
  const s={...inv.sources.find(s=>s.id==='s1'),id:'s2',url:'https://another.example.org/'};
  inv.sources.push(s);addFinding(inv,{category:f.category,field:f.field,value:f.value,identity:'candidate'},s);
  assert.equal(inv.findings.filter(item=>item.value===f.value).length,2);
});
test('reviews require reasons, reject stale submissions, and expire when evidence changes',async t=>{
  const {w,inv,f}=await base(t),before=contentHash(inv);
  await assert.rejects(()=>w.review(inv.id,f.id,before,{decision:'accepted',identity:'matched',reason:'',analyst:'Analyst'}));
  await w.review(inv.id,f.id,before,{decision:'accepted',identity:'matched',reason:'Explicit primary-source cross-link reviewed.',analyst:'Analyst'});
  let current=await w.load(inv.id);
  assert.equal(assessFinding(current,f).review,'accepted');
  assert.equal(assessFinding(current,f).identity,'matched');
  await assert.rejects(()=>w.review(inv.id,f.id,before,{decision:'rejected',identity:'different',reason:'stale form',analyst:'Analyst'}),/Report changed/);
  current.evidence[0].excerpt+=' Updated.';
  await w.save(current);
  current=await w.load(inv.id);
  assert.equal(assessFinding(current,f).review,'pending');
  assert.equal(assessFinding(current,f).stale_reviews,1);
  assert.equal(compareReports(inv,current).changed.length,1);
});
test('collector checkpoints preserve decisions and cannot rewrite review events',async t=>{
  const {w,inv,f}=await base(t);
  await w.review(inv.id,f.id,contentHash(inv),{decision:'rejected',identity:'different',reason:'Different institution and explicit identity.',analyst:'Analyst'});
  await w.save(inv);
  const current=await w.load(inv.id);
  assert.equal(current.reviews.length,1);
  assert.equal(assessFinding(current,f).review,'rejected');
  current.reviews[0].reason='rewrite';
  await assert.rejects(()=>w.save(current),/cannot be rewritten/);
});
test('rejected evidence cannot be cited and review invalidates old AI prose',async t=>{
  const {w,inv,f}=await base(t);
  inv.ai={model:'fixture',status:'complete',sections:[{title:'Overview',paragraphs:[{text:'Candidate Name.',evidence_ids:[inv.evidence[0].id]}]}],limitations:[]};
  await w.save(inv);
  await w.review(inv.id,f.id,contentHash(inv),{decision:'rejected',identity:'different',reason:'Wrong identity.',analyst:'Analyst'});
  const current=await w.load(inv.id);
  assert.equal(current.ai.sections.length,0);
  assert.equal(current.ai.status,'partial');
  assert.throws(()=>validateArticleSections(inv.ai,current),/unsupported evidence/);
  let chats=0;
  await researchWithAI(current,async path=>{if(path==='/models')return{data:[{id:'deepseek-flash'}]};chats++;throw Error('should not synthesize');},{synthesisOnly:true});
  assert.equal(chats,0);
});
test('revisions and snapshots remain portable and detect altered content',async t=>{
  const {w,inv}=await base(t),hash=contentHash(inv);
  const history=await w.history(inv.id);
  assert.ok(history.some(r=>r.hash===hash));
  inv.summary='Changed summary';await w.save(inv);
  assert.notEqual(contentHash(inv),hash);
  const old=await w.readObject(inv.id,'revisions',hash);
  assert.notEqual(old.summary,inv.summary);
  const output=await w.export(inv.id);
  const snapshot=inv.sources.find(s=>s.snapshot_hash).snapshot_hash;
  assert.ok(JSON.parse(await readFile(join(output,'snapshots',snapshot+'.json'),'utf8')).name);
  assert.ok(JSON.parse(await readFile(join(output,'revisions',hash+'.json'),'utf8')).id);
  await writeFile(join(w.reportPath(inv.id),'snapshots',snapshot+'.json'),'{}');
  await assert.rejects(()=>w.readObject(inv.id,'snapshots',snapshot),/integrity/);
  await assert.rejects(()=>w.export(inv.id),/integrity/);
});
test('content object reads reject traversal and symbolic files',async t=>{
  const {w,inv}=await base(t);
  await assert.rejects(()=>w.readObject(inv.id,'snapshots','../config'),/Invalid content hash/);
  if(process.platform==='win32')return;
  const hash='a'.repeat(64);
  await symlink(join(w.root,'config.json'),join(w.reportPath(inv.id),'snapshots',hash+'.json'));
  await assert.rejects(()=>w.readObject(inv.id,'snapshots',hash),/regular files/);
});
test('pagination follows only bounded same-endpoint continuations and retains earlier pages on failure',async()=>{
  const task=accountTasks({platform:'github',username:'example'},'standard','candidate').find(t=>t.adapter==='github-projects');
  let calls=[];
  const repo=n=>({name:n,html_url:`https://github.com/example/${n}`,created_at:'2020-01-01',fork:false});
  const http={get:async url=>{calls.push(url);if(calls.length===1)return{data:[repo('one')],retrieved_at:'2026-01-01',cached:false,next_url:task.url+'&page=2'};return{data:[repo('two')],retrieved_at:'2026-01-01',cached:false};}};
  let result=await collect(task,http,3);
  assert.equal(result.records.length,2);assert.equal(result.pages,2);assert.equal(result.payload.pages.length,2);
  for(const next of ['https://evil.example.org/data',task.url+'&page=2&token=secret',task.url.replace('example/','other/')+'&page=2']){
    calls=[];http.get=async url=>{calls.push(url);return{data:[repo('one')],retrieved_at:'2026-01-01',cached:true,next_url:next};};
    try {result=await collect(task,http,3);assert.match(result.limitation,/Pagination/);} catch(e){assert.match(e.message,/credential/);}
    assert.equal(calls.length,1);
  }
  calls=[];http.get=async()=>{if(calls.push(1)===1)return{data:[repo('one')],retrieved_at:'2026-01-01',cached:false,next_url:task.url+'&page=2'};throw new SourceError('Budget exhausted','budget_exhausted');};
  result=await collect(task,http,3);assert.equal(result.records.length,1);assert.match(result.limitation,/budget_exhausted/);
});
test('HTTP request budgets also apply to cache and retry-after parsing is bounded by callers',async t=>{
  const {w}=await base(t),client=new HttpClient(join(w.root,'cache'),undefined,false,3600000,{maxRequests:1});
  client.request=async()=>({ok:true});
  await client.get('https://example.org/data');
  await assert.rejects(()=>client.get('https://example.org/data'),e=>e.code==='budget_exhausted');
  assert.equal(retryAfter('3'),3000);assert.equal(retryAfter('invalid'),undefined);
  assert.equal(retryAfter('Thu, 01 Jan 1970 00:00:00 GMT',10000),0);
  const limited=new HttpClient(join(w.root,'cache'));let calls=0;
  limited.request=async()=>{calls++;throw new SourceError('HTTP 429','rate_limited',429,60000);};
  await assert.rejects(()=>limited.get('https://another.example.org/data'),e=>e.code==='rate_limited');
  assert.equal(calls,1);
});
test('AI call budgets count retries and output limits bound each model request',async t=>{
  let bodies=[];t.mock.method(globalThis,'fetch',async(_url,options)=>{bodies.push(JSON.parse(options.body||'{}'));return new Response(JSON.stringify({usage:{},choices:[]}),{status:200});});
  const provider=new DeepSeek('fixture',undefined,{maxCalls:1,maxOutputTokens:100});
  await provider.request('/chat/completions',{model:'fixture',max_tokens:12000});
  assert.equal(bodies[0].max_tokens,100);
  await assert.rejects(()=>provider.request('/models'),/budget exhausted/);assert.equal(bodies.length,1);
});
test('search index updates transactionally, removes deleted reports and treats SQL as data',async t=>{
  const {w,inv}=await base(t);
  const found=await searchWorkspace(w,'Candidate');assert.equal(found.results[0].id,inv.id);
  await assert.rejects(()=>searchWorkspace(w,' '));
  const malicious=await searchWorkspace(w,"' OR 1=1 --");assert.equal(malicious.results.length,0);
  inv.findings.find(f=>f.value==='Candidate Name').value='Renamed Example';await w.save(inv);
  assert.equal((await searchWorkspace(w,'Candidate')).results.length,0);
  assert.equal((await searchWorkspace(w,'Renamed')).results.length,1);
  await rm(w.reportPath(inv.id),{recursive:true});
  assert.equal((await searchWorkspace(w,'Renamed')).results.length,0);
});
test('CLI review, history, integrity verification and local search work together',async t=>{
  const {w,inv,f}=await base(t),env={...process.env,PHOMBER_HOME:w.root,DEEPSEEK_API_KEY:''};
  const run=async(...args)=>JSON.parse((await exec(process.execPath,['dist/cli/index.js',...args,'--format','json'],{env})).stdout);
  assert.equal((await run('review',inv.id)).find(r=>r.id===f.id).review,'pending');
  assert.equal((await run('review',inv.id,f.id,'--decision','accepted','--identity','matched','--reason','Reviewed primary cross-link.','--analyst','Fixture')).review,'saved');
  assert.ok((await run('history',inv.id)).length>=2);
  assert.equal((await run('verify',inv.id)).integrity,'passed');
  assert.equal((await run('search','Candidate')).results[0].id,inv.id);
});
test('review pages enforce CSRF, origin, revision freshness and export preserved evidence',async t=>{
  const {w,inv,f}=await base(t),{server,url}=await startServer(w,0);
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const html=await (await fetch(`${url}/reports/${inv.id}/review/`)).text();
  assert.match(html,/Candidate resources/);assert.match(html,/Extraction:/);
  const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const post=(override={})=>fetch(url+'/manage/reviews',{method:'POST',redirect:'manual',headers:{Origin:url,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,report:inv.id,finding:f.id,revision:contentHash(inv),decision:'accepted',identity:'matched',analyst:'Fixture',reason:'Reviewed source.',...override})});
  assert.equal((await post({csrf:'bad'})).status,403);
  assert.equal((await post()).status,303);
  assert.equal((await post()).status,409);
  assert.equal((await w.load(inv.id)).reviews.length,1);
  const history=await w.history(inv.id);
  for(const path of [`revisions/`,`revisions/?compare=${history[0].hash}`,`revisions/${history[0].hash}.json`,`snapshots/${inv.sources.find(s=>s.snapshot_hash).snapshot_hash}.json`,`graph.json`])
    assert.equal((await fetch(`${url}/reports/${inv.id}/${path}`)).status,200,path);
  const graph=await (await fetch(`${url}/reports/${inv.id}/graph.json`)).json();
  assert.ok(graph.edges.every(e=>e.relationship==='reports'));
});

test('interrupted collections recover intact fresh task snapshots when cache was lost',async t=>{
  const {w}=await base(t);
  const input={schema_version:'1.0',subject:{socials:[{platform:'github',username:'checkpoint-example'}]},research:{depth:'quick',offline:true}};
  const {createHash}=await import('node:crypto');
  const url='https://api.github.com/users/checkpoint-example';
  await writeFile(join(w.root,'cache',createHash('sha256').update(url).digest('hex')+'.json'),JSON.stringify({data:{login:'checkpoint-example',name:'Checkpoint Name'},retrieved_at:new Date().toISOString(),cached:false}));
  const first=await investigate(input,w);
  assert.equal(first.tasks[0].status,'succeeded');
  first.status='interrupted';await w.save(first);
  await rm(join(w.root,'cache'),{recursive:true});
  const resumed=await investigate(input,w,{resume:first});
  assert.equal(resumed.status,'complete');assert.match(resumed.tasks[0].detail,/Recovered/);
  assert.ok(resumed.findings.some(f=>f.value==='Checkpoint Name'));
  const changed=await investigate({...input,subject:{...input.subject,name:'Changed Subject'}},w,{resume:first});
  assert.ok(!changed.findings.some(f=>f.value==='Checkpoint Name'));
});
test('network errors count against AI call budgets and never imply known zero billing',async t=>{
  const {summarizeUsage}=await import('../dist/ai/usage.js');
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Connection lost after send');});
  const provider=new DeepSeek('fixture',undefined,{maxCalls:1});
  await assert.rejects(()=>provider.request('/chat/completions',{}),/Connection lost/);
  await assert.rejects(()=>provider.request('/models'),/budget exhausted/);
  assert.equal(calls,1);assert.equal(provider.calls[0].status,0);
  assert.equal(summarizeUsage(provider.calls).estimated_usd_max,null);
});
test('AI sharing preferences and budgets persist in investigation input',async()=>{
  const {inputFromArgs,parse}=await import('../dist/cli/input.js');
  const input=await inputFromArgs(parse(['--name','Example','--no-ai','--max-ai-calls','3','--max-output-tokens','1000']));
  assert.equal(input.research.ai,false);assert.equal(input.research.max_ai_calls,3);
  assert.equal((await inputFromArgs(parse([]),input)).research.ai,false);
  assert.equal((await inputFromArgs(parse(['--ai']),input)).research.ai,true);
  await assert.rejects(()=>inputFromArgs(parse(['--name','Example','--max-ai-calls=-1'])));
});

test('DeepSeek-only mode persists, enables AI explicitly and issues no adapter lookups',async t=>{
  const {inputFromArgs,parse}=await import('../dist/cli/input.js');
  const original={schema_version:'1.0',subject:{name:'Example Researcher',socials:[{platform:'github',username:'fixture'}],domains:['example.com']},research:{offline:true,ai:false}};
  const input=await inputFromArgs(parse(['--ai-only']),original);
  assert.equal(input.research.ai_only,true);assert.equal(input.research.ai,true);assert.equal(input.research.offline,false);
  assert.equal((await inputFromArgs(parse([]),input)).research.ai_only,true);
  assert.equal((await inputFromArgs(parse(['--no-ai']),input)).research.ai_only,false);
  t.mock.method(HttpClient.prototype,'get',async()=>{throw Error('An adapter request must never run in DeepSeek-only mode');});
  const root=await mkdtemp(join(tmpdir(),'phomber-ai-only-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const inv=await investigate(input,new Workspace(root));
  assert.deepEqual(inv.tasks,[]);assert.deepEqual(inv.sources,[]);
  assert.ok(inv.findings.some(f=>f.value==='Example Researcher' && f.status==='user-provided'));
  assert.ok(inv.warnings.some(w=>w.includes('DeepSeek-only mode')));
});

test('partial dates respect leap years and real calendar bounds',async()=>{
  const {validateInput}=await import('../dist/core/schema.js');
  for(const start of ['2024-02-29','2000-02-29','2020','2020-12'])
    validateInput({schema_version:'1.0',subject:{name:'Example',education:[{date:{start}}]}});
  for(const start of ['2023-02-29','1900-02-29','2020-13','2020-04-31','2020-00-01'])
    assert.throws(()=>validateInput({schema_version:'1.0',subject:{name:'Example',education:[{date:{start}}]}}),/Invalid investigation input/);
});
