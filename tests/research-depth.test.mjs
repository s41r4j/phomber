import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../dist/workspace/index.js';
import {investigate,addFinding,profileEnricher} from '../dist/core/engine.js';
import {identitySupport,researchEvidence,researchCoverage} from '../dist/core/research.js';
import {makeReview} from '../dist/core/trust.js';
import {researchWithAI} from '../dist/ai/deepseek.js';
import {validateInvestigation} from '../dist/core/schema.js';
import {renderReport} from '../dist/reports/html.js';
import {reportTitle} from '../dist/catalog/index.js';
import {HttpClient} from '../dist/adapters/http.js';
const subject={name:'Casey Researcher',education:[{institution:'Example College'}],socials:[{platform:'github',username:'casey'}]};
async function base(t,depth='standard') {
  const root=await mkdtemp(join(tmpdir(),'phomber-depth-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const w=new Workspace(root);
  const inv=await investigate({schema_version:'1.0',subject:{name:subject.name},research:{depth,offline:true}},w);
  inv.sources=[];inv.tasks=[];inv.evidence=[]; inv.findings=inv.findings.filter(f=>f.status==='user-provided');
  inv.input.subject=structuredClone(subject);inv.input.research.offline=false;
  return {w,inv};
}
function add(inv,id,url,quote,{field='name',value='Casey Researcher',category='identity',adapter='fixture'}={}) {
  let source=inv.sources.find(s=>s.id===id);
  if(!source){source={id,url,adapter,status:'ok',retrieved_at:inv.created_at};inv.sources.push(source);}
  addFinding(inv,{category,field,value,excerpt:quote,identity:'candidate'},source);
  return inv.findings.at(-1);
}
const response=value=>({choices:[{message:{content:JSON.stringify(value)},finish_reason:'stop'}]});
const data=body=>JSON.parse(body.messages[1].content.split('\nUNTRUSTED RESEARCH DATA:\n')[1]);
const narrative=evidence=>response({sections:[{title:'Overview',paragraphs:[{text:'The retained sources describe a candidate public profile.',evidence_ids:[evidence[0].id]}]}]});

test('automatic resource matching explains supplied links and context without certifying names or handles',async t=>{
  const {inv}=await base(t);
  add(inv,'direct','https://api.github.com/users/casey','name: Casey Researcher');
  add(inv,'context','https://example.edu/event','Casey Researcher represented Example College in a public theatre event.');
  add(inv,'bare','https://example.org/person','Casey Researcher writes about software.');
  add(inv,'handle','https://gitlab.com/casey','The public username is casey.',{field:'username',value:'casey'});
  add(inv,'link','https://example.edu/profile','Casey Researcher links to https://github.com/casey for public projects.');
  add(inv,'partial','https://example.org/other','Casey Researcherson represented Example College.');
  add(inv,'imported','https://example.org/import','Casey Researcher links to https://github.com/casey',{adapter:'imported-evidence'});
  const states=Object.fromEntries(identitySupport(inv).map(s=>[s.source_id,s.state]));
  assert.deepEqual(states,{direct:'supported-link',context:'context-consistent',bare:'unresolved',handle:'unresolved',link:'supported-link',partial:'unresolved',imported:'unresolved'});
  assert.ok(inv.findings.filter(f=>f.source_ids.length).every(f=>f.status==='lead'));
  assert.match(renderReport(inv),/Automatic resource matching/);
  assert.match(renderReport(inv),/Supported resource links; claims assessed separately/);
  validateInvestigation(inv);
});
test('a reviewed different identity overrides automatic matching and excluded evidence is never shared',async t=>{
  const {inv}=await base(t);
  const finding=add(inv,'direct','https://api.github.com/users/casey','name: Casey Researcher');
  inv.reviews=[makeReview(inv,finding.id,{identity:'different',decision:'rejected',reason:'Different person confirmed.',analyst:'Fixture analyst'})];
  assert.equal(identitySupport(inv)[0].state,'conflicting');
  assert.deepEqual(researchEvidence(inv),[]);
});
test('source-balanced context retains institutional evidence alongside a prolific project API',async t=>{
  const {inv}=await base(t);
  for(let i=0;i<30;i++)add(inv,'repos','https://api.github.com/users/casey/repos',`Project ${i} has a public source description.`,{category:'projects',field:`Project ${i}`,value:`Project ${i}`});
  add(inv,'college','https://example.edu/profile','Casey Researcher studies at Example College.',{category:'education'});
  assert.equal(researchEvidence(inv,2)[1].source_url,'https://example.edu/profile');
  assert.equal(researchCoverage(inv).find(c=>c.topic==='projects').excerpts,30);
});
test('planning and gap review combine local evidence; follow-up URLs must occur in actual evidence',async t=>{
  const {inv}=await base(t);inv.input.subject={name:subject.name};
  add(inv,'local','https://api.github.com/users/casey','Casey Researcher maintains Stage Tools at https://github.com/casey.',{field:'project',category:'projects',value:'Stage Tools'});
  let reviewed=false,planContext;const fetched=[],searches=[],enriched=[];
  await researchWithAI(inv,async(path,body)=>{
    if(path==='/models')return {data:[{id:'deepseek-flash'}]};
    if(path==='/v1/tools/search'){searches.push(body.query);return {results:[{url:'https://example.edu/arts'}]};}
    if(path==='/v1/tools/fetch'){fetched.push(body.url);return {content:'Casey Researcher joined Example College theatre. Details: https://example.edu/programme'};}
    const prompt=body.messages[1].content;
    if(prompt.startsWith('Plan')){planContext=data(body);return response({queries:['"Casey Researcher" theatre']});}
    if(prompt.startsWith('Extract'))return response({claims:[{url:data(body).documents[0].url,category:'community',field:'Arts',value:'theatre',quote:'Casey Researcher joined Example College theatre.'}],queries:[]});
    if(prompt.startsWith('Review')){reviewed=true;assert.ok(data(body).evidence.some(e=>e.value==='Stage Tools'));return response({queries:['"Casey Researcher" theatre programme'],follow_urls:['https://example.edu/programme','https://invented.example.org/not-in-evidence']});}
    return narrative(data(body).evidence);
  },{enrichProfiles:async urls=>enriched.push(...urls)});
  assert.ok(planContext.evidence.some(e=>e.value==='Stage Tools'));
  assert.ok(reviewed);assert.ok(searches.includes('"Casey Researcher" theatre programme'));
  assert.ok(fetched.includes('https://example.edu/programme'));
  assert.ok(!fetched.some(url=>url.includes('invented')));
  assert.ok(enriched.includes('https://github.com/casey'));
  assert.equal(inv.ai.status,'complete');validateInvestigation(inv);
});
test('large deep rounds extract every fetched page rather than dropping the earliest documents',async t=>{
  const {inv}=await base(t,'deep');inv.input.subject={name:subject.name};
  let query=0;const fetched=new Set(),extracted=new Set();
  await researchWithAI(inv,async(path,body)=>{
    if(path==='/models')return {data:[{id:'deepseek-flash'}]};
    if(path==='/v1/tools/search'){query++;return {results:[1,2,3,4,5].map(n=>({url:`https://example.edu/q${query}-page${n}`}))};}
    if(path==='/v1/tools/fetch'){fetched.add(body.url);return {content:`Casey Researcher presented public project ${new URL(body.url).pathname}.`};}
    const prompt=body.messages[1].content;
    if(prompt.startsWith('Plan'))return response({queries:Array.from({length:20},(_,i)=>`Casey topic ${i}`)});
    if(prompt.startsWith('Review'))return response({queries:[]});
    if(prompt.startsWith('Extract'))return response({claims:data(body).documents.map(d=>{extracted.add(d.url);return {url:d.url,category:'projects',field:new URL(d.url).pathname,value:'Casey Researcher',quote:d.content};})});
    return narrative(data(body).evidence);
  });
  assert.equal(query,16);assert.equal(fetched.size,30);
  assert.deepEqual([...extracted].sort(),[...fetched].sort());
  assert.equal(inv.evidence.length,30);validateInvestigation(inv);
});
test('planning and extraction failures preserve local evidence for synthesis',async t=>{
  const {inv}=await base(t,'quick');inv.input.subject={name:subject.name};
  add(inv,'local','https://example.edu/profile','Casey Researcher is listed in the public programme.');
  await researchWithAI(inv,async(path,body)=>{
    if(path==='/models')return {data:[{id:'deepseek-flash'}]};
    if(path==='/v1/tools/search')return {results:[{url:'https://example.edu/web'}]};
    if(path==='/v1/tools/fetch')return {content:'Public programme lists Casey Researcher.'};
    const prompt=body.messages[1].content;
    if(prompt.startsWith('Plan')||prompt.startsWith('Extract'))throw Error('Fixture provider failure');
    return narrative(data(body).evidence);
  });
  assert.equal(inv.ai.status,'complete');
  assert.ok(inv.ai.limitations.some(l=>l.includes('planning unavailable')));
  assert.ok(inv.ai.limitations.some(l=>l.includes('extraction unavailable')));
  assert.equal(inv.evidence.length,1);assert.equal(inv.status,'partial');
});
test('AI-only and synthesis-only never invoke local enrichment; supplied URLs are read directly',async t=>{
  const {inv}=await base(t,'quick');inv.input.research.ai_only=true;
  let local=0;const fetched=[];
  await researchWithAI(inv,async(path,body)=>{
    if(path==='/models')return {data:[{id:'deepseek-flash'}]};
    if(path==='/v1/tools/search')return {results:[]};
    if(path==='/v1/tools/fetch'){fetched.push(body.url);return {content:'Casey Researcher maintains public projects.'};}
    const prompt=body.messages[1].content;
    if(prompt.startsWith('Plan'))return response({queries:[]});
    if(prompt.startsWith('Extract'))return response({claims:[{url:data(body).documents[0].url,category:'identity',field:'name',value:'Casey Researcher',quote:'Casey Researcher maintains public projects.'}]});
    return narrative(data(body).evidence);
  },{enrichProfiles:async()=>local++});
  assert.equal(local,0);assert.deepEqual(fetched,['https://github.com/casey']);
  await researchWithAI(inv,async(path,body)=>path==='/models'?{data:[{id:'deepseek-flash'}]}:narrative(data(body).evidence),{synthesisOnly:true,enrichProfiles:async()=>local++});
  assert.equal(local,0);validateInvestigation(inv);
});
test('discovered API profiles use bounded adapters, deduplicate tasks, preserve snapshots and ignore unknown hosts',async t=>{
  const {inv,w}=await base(t,'quick');
  const urls=[];
  t.mock.method(HttpClient.prototype,'get',async url=>{urls.push(url);return {data:{login:'casey',name:'Casey Researcher',html_url:'https://github.com/casey'},retrieved_at:inv.created_at,cached:false};});
  const enrich=profileEnricher(inv,w,{});
  await enrich(['https://github.com.evil.example/casey','https://github.com/casey/project','https://github.com/casey','https://github.com/casey','https://github.com/other','https://github.com/third']);
  assert.deepEqual(urls,['https://api.github.com/users/casey','https://api.github.com/users/other']);
  assert.ok(inv.sources.every(s=>s.snapshot_hash));
  assert.equal(inv.tasks.length,2);assert.ok(inv.tasks.every(t=>t.status==='succeeded'));
  validateInvestigation(inv);
});
test('cancellation stops research before the next paid fetch or synthesis',async t=>{
  const {inv}=await base(t,'quick');inv.input.subject={name:subject.name};
  const controller=new AbortController();let fetched=0;
  await assert.rejects(()=>researchWithAI(inv,async(path,body)=>{
    if(path==='/models')return {data:[{id:'deepseek-flash'}]};
    if(path==='/v1/tools/search'){controller.abort();return {results:[{url:'https://example.edu/profile'}]};}
    if(path==='/v1/tools/fetch')fetched++;
    return response({queries:['Casey Researcher']});
  },{signal:controller.signal}),{name:'AbortError'});
  assert.equal(fetched,0);
});

 test('candidate names do not rename a handle-only report; supplied-account names can supply its title',async t=>{
  const {inv}=await base(t);inv.input.subject={socials:[{platform:'github',username:'casey'}]};
  const candidate=add(inv,'other','https://example.edu/person','An unrelated person is listed here.',{value:'An Unrelated Longer Name'});
  assert.equal(reportTitle(inv),'casey');
  const supplied=add(inv,'profile','https://api.github.com/users/casey','name: Casey Researcher');
  supplied.identity='anchored';assert.equal(reportTitle(inv),'Casey Researcher');
  supplied.status='conflicting';assert.equal(reportTitle(inv),'casey');
});

test('conflicting or excluded education and employment do not populate the biography infobox',async t=>{
  const {inv}=await base(t);
  const employer=add(inv,'wrong','https://example.org/wrong','The candidate lists Wrong Employer.',{category:'professional',field:'company',value:'Wrong Employer'});
  const school=add(inv,'wrong-school','https://example.org/wrong-school','The candidate lists Wrong College.',{category:'education',field:'institution',value:'Wrong College'});
  employer.status='conflicting';
  inv.reviews=[makeReview(inv,school.id,{decision:'rejected',identity:'different',reason:'An unrelated candidate.',analyst:'Fixture analyst'})];
  const html=renderReport(inv);
  assert.doesNotMatch(html,/<th>Organization<\/th><td>Wrong Employer/);
  assert.doesNotMatch(html,/<th>Education<\/th><td>Wrong College/);
  assert.ok(inv.evidence.some(e=>e.excerpt.includes('Wrong Employer')));
  assert.ok(inv.evidence.some(e=>e.excerpt.includes('Wrong College')));
});
test('cancellation of a discovered profile records a cancelled task and retains earlier evidence',async t=>{
  const {inv,w}=await base(t,'quick'),controller=new AbortController();
  t.mock.method(HttpClient.prototype,'get',async()=>{controller.abort();throw new DOMException('Cancelled','AbortError');});
  await assert.rejects(()=>profileEnricher(inv,w,{signal:controller.signal})(['https://github.com/casey']),{name:'AbortError'});
  assert.equal(inv.tasks[0].status,'cancelled');assert.ok(inv.tasks[0].finished_at);
  assert.equal(inv.sources[0].status,'unavailable');
});

test('conflicting supplied display names do not silently choose the longest as the discovered identity',async t=>{
  const {inv}=await base(t);inv.input.subject={socials:[{platform:'github',username:'casey'},{platform:'dev',username:'casey'}]};
  const one=add(inv,'first','https://api.github.com/users/casey','name: Casey Researcher');one.identity='anchored';
  assert.equal(reportTitle(inv),'Casey Researcher');
  assert.equal(identitySupport(inv)[0].state,'supported-link');
  const two=add(inv,'second','https://dev.to/api/users/by_username?url=casey','name: A Different Person',{value:'A Different Person'});two.identity='anchored';
  assert.equal(reportTitle(inv),'casey');
});

test('distinct literal excerpts for the same fact are retained and deduplicated without false corroboration',async t=>{
  const {inv}=await base(t);
  add(inv,'school','https://example.edu/person','Casey Researcher is listed in the programme.');
  add(inv,'school','https://example.edu/person','Casey Researcher represents Example College at the event.');
  add(inv,'school','https://example.edu/person','Casey Researcher represents Example College at the event.');
  assert.equal(inv.evidence.length,2);assert.equal(inv.findings.filter(f=>f.source_ids.length).length,1);
  assert.equal(identitySupport(inv)[0].state,'context-consistent');
  assert.equal(inv.findings.find(f=>f.source_ids.length).status,'lead');validateInvestigation(inv);
});
test('public qualifications can be extracted while login credentials and invented quotes are rejected',async t=>{
  const {inv}=await base(t,'quick');inv.input.subject={name:subject.name};
  const quote='Casey Researcher earned Example Certificate in 2025.';
  await researchWithAI(inv,async(path,body)=>{
    if(path==='/models')return {data:[{id:'deepseek-flash'}]};
    if(path==='/v1/tools/search')return {results:[{url:'https://example.edu/certificate'}]};
    if(path==='/v1/tools/fetch')return {content:quote};
    const prompt=body.messages[1].content;
    if(prompt.startsWith('Plan'))return response({queries:['Casey qualifications']});
    if(prompt.startsWith('Extract'))return response({claims:[
      {url:'https://example.edu/certificate',category:'achievements',field:'credential title',value:'Example Certificate',quote},
      {url:'https://example.edu/certificate',category:'identity',field:'login credential',value:'Example Certificate',quote},
      {url:'https://example.edu/certificate',category:'achievements',field:'Other certificate',value:'Invented Certificate',quote:'Casey earned Invented Certificate.'}]});
    return narrative(data(body).evidence);
  });
  assert.equal(inv.evidence.length,1);assert.equal(inv.findings.find(f=>f.source_ids.length).field,'credential title');validateInvestigation(inv);
});

test('a supplied web profile reporting a different name is flagged before narrative synthesis',async t=>{
  const {inv}=await base(t,'quick');let received;
  await researchWithAI(inv,async(path,body)=>{
    if(path==='/models')return {data:[{id:'deepseek-flash'}]};
    if(path==='/v1/tools/search')return {results:[]};
    if(path==='/v1/tools/fetch')return {content:'Another Person maintains public projects on this profile.'};
    const prompt=body.messages[1].content;
    if(prompt.startsWith('Plan'))return response({queries:[]});
    if(prompt.startsWith('Extract'))return response({claims:[{url:data(body).documents[0].url,category:'identity',field:'name',value:'Another Person',quote:'Another Person maintains public projects on this profile.'}]});
    received=data(body);return narrative(received.evidence);
  });
  assert.equal(inv.findings.find(f=>f.value==='Another Person').status,'conflicting');
  assert.equal(received.evidence[0].identity_support.state,'conflicting');validateInvestigation(inv);
});
