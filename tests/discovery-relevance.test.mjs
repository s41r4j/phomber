import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../dist/workspace/index.js';
import {investigate,addFinding,correlate,profileEnricher} from '../dist/core/engine.js';
import {discoveredIdentity} from '../dist/core/identity.js';
import {identitySupport,researchName,matchingQueries,researchRelevance} from '../dist/core/research.js';
import {researchWithAI,retainIdentityLinks,retainPublicContacts} from '../dist/ai/deepseek.js';
import {HttpClient} from '../dist/adapters/http.js';
import {sanitizeDocumentText} from '../dist/adapters/documents.js';
import {publicContactAllowed} from '../dist/core/contacts.js';
import {concurrentMap} from '../dist/core/concurrency.js';
import {renderReport} from '../dist/reports/html.js';
import {validateInvestigation} from '../dist/core/schema.js';
import {publicationAttribution} from '../dist/core/publications.js';
const response=o=>({choices:[{message:{content:JSON.stringify(o)}}]});
const data=body=>JSON.parse(body.messages[1].content.split('\nUNTRUSTED RESEARCH DATA:\n')[1]);
async function base(t,depth='standard') {
 const root=await mkdtemp(join(tmpdir(),'phomber-discovery-'));t.after(()=>rm(root,{recursive:true,force:true}));const w=new Workspace(root);
 const inv=await investigate({schema_version:'1.0',subject:{name:'casey42'},research:{depth,offline:true}},w);
 inv.sources=[];inv.tasks=[];inv.input.research.offline=false;return {inv,w};
}
function fact(inv,id,url,field,value,{category='identity',adapter='fixture',excerpt=value,identity='candidate'}={}){
 let source=inv.sources.find(s=>s.id===id);if(!source){source={id,url,adapter,status:'ok',retrieved_at:inv.created_at};inv.sources.push(source);}
 addFinding(inv,{category,field,value,excerpt,identity},source);return source;
}
function account(inv,id='account',user='casey42',name='Casey Researcher'){
 const source=fact(inv,id,'https://api.github.com/users/'+user,'github username',user,{category:'online',adapter:'github'});
 fact(inv,id,source.url,'name',name,{adapter:'github',excerpt:'name: '+name});return source;
}
test('a handle label discovers a seed-linked full name and CV context without changing investigator input',async t=>{
 const {inv}=await base(t);account(inv);const cv='https://github.com/casey42/casey42/releases/download/v1/cv.pdf';
 const source=fact(inv,'cv',cv,'name','Casey Researcher');fact(inv,'cv',cv,'institution','Example College',{category:'education'});
 fact(inv,'cv',cv,'employer','Example Labs',{category:'professional'});
 assert.equal(researchName(inv),'Casey Researcher');assert.equal(inv.input.subject.name,'casey42');
 assert.equal(identitySupport(inv).find(s=>s.source_id===source.id).state,'supported-link');
 assert.ok(matchingQueries(inv).includes('"Casey Researcher" "casey42"'));
 assert.ok(matchingQueries(inv).includes('"Casey Researcher" "Example College"'));
 assert.ok(matchingQueries(inv).includes('"Casey Researcher" "Example Labs"'));
 correlate(inv);assert.ok(!inv.findings.some(f=>f.status==='conflicting'));validateInvestigation(inv);
});
test('same handle on another account, discovery-list names, unrelated CVs and conflicting roots cannot rename a subject',async t=>{
 const {inv}=await base(t);fact(inv,'wrong','https://api.github.com/users/someone-else','name','Another Person',{adapter:'github'});
 fact(inv,'wrong','https://api.github.com/users/someone-else','github username','casey42',{category:'online',adapter:'github'});
 fact(inv,'search','https://api.github.com/search/users?q=casey42','name','Another Person',{adapter:'github-search'});
 assert.equal(researchName(inv),undefined);account(inv);
 fact(inv,'cv','https://github.com/other/casey42/releases/download/v1/cv.pdf','name','Casey Researcher');
 assert.equal(identitySupport(inv).find(s=>s.source_id==='cv').expand,false);
 inv.input.subject.socials=[{platform:'github',username:'other'}];account(inv,'different','other','Different Researcher');
 assert.equal(researchName(inv),undefined);assert.match(discoveredIdentity(inv).basis,/Conflicting/);
});
test('genuine supplied full names still conflict with another surname; contact facts do not define identity',async t=>{
 const {inv}=await base(t);inv.input.subject={name:'Casey Researcher',socials:[{platform:'github',username:'casey42'}]};
 fact(inv,'wrong','https://api.github.com/users/casey42','name','Casey Stranger',{adapter:'github',identity:'anchored'});correlate(inv);
 assert.equal(researchName(inv),'Casey Researcher');assert.equal(identitySupport(inv)[0].state,'conflicting');
 assert.equal(publicContactAllowed(inv,'wrong','public-contact','public email','c@example.org','Contact email: c@example.org'),false);
});
test('literal first-party links retain the identity connection and rank useful sources above directory noise',async t=>{
 const {inv}=await base(t);account(inv);const source={id:'web',url:'https://github.com/casey42',adapter:'deepseek-web-fetch',status:'ok',retrieved_at:inv.created_at};inv.sources.push(source);
 const cv='https://example.org/cv.pdf';retainIdentityLinks(inv,[{url:source.url,source,content:'Casey Researcher. Resume: '+cv}]);
 fact(inv,'cv',cv,'name','Casey Researcher');fact(inv,'cv',cv,'institution','Example College',{category:'education'});
 assert.equal(identitySupport(inv).find(s=>s.source_id==='cv').expand,true);
 assert.ok(researchRelevance(inv,cv).score>researchRelevance(inv,'https://elsewhere.org/topics/casey42').score);
 assert.ok(researchRelevance(inv,'https://college.edu/profile','Casey Researcher Example College').reasons.includes('Retained institution, employer or project context'));
});
test('derived names rerun bounded local name adapters once and keep publications as name-only candidates',async t=>{
 const {inv,w}=await base(t);account(inv);const requests=[];
 t.mock.method(HttpClient.prototype,'get',async url=>{requests.push(url);return {data:url.includes('crossref')?{message:{items:[{URL:'https://doi.org/10.1234/casey',DOI:'10.1234/casey',title:['Fixture paper'],author:[{given:'Casey',family:'Researcher'}]}]}}:{items:[],search:[]},retrieved_at:inv.created_at,cached:false};});
 const enrich=profileEnricher(inv,w,{});await enrich([],researchName(inv));await enrich([],researchName(inv));
 assert.equal(requests.length,3);assert.ok(requests.some(url=>url.includes('crossref')&&url.includes('Casey%20Researcher')));
 assert.equal(publicationAttribution(inv,inv.findings.find(f=>f.category==='publications')).state,'author-name-only');
 validateInvestigation(inv);
});
test('bounded work overlaps I/O, preserves input order and settles active work before cancellation returns',async()=>{
 let active=0,peak=0;const controller=new AbortController();
 const values=await concurrentMap([1,2,3,4,5],3,async n=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return n*2;});
 assert.deepEqual(values,[2,4,6,8,10]);assert.equal(peak,3);
 await assert.rejects(()=>concurrentMap([1,2,3,4,5],3,async n=>{active++;await new Promise(r=>setTimeout(r,2));active--;if(n===1)controller.abort();return n;},controller.signal),{name:'AbortError'});
 assert.equal(active,0);
});
test('searches and page reads overlap with serialized checkpoints; relevant result beats a broad first hit',async t=>{
 const {inv}=await base(t,'quick');let searchActive=0,searchPeak=0,fetchActive=0,fetchPeak=0,writes=0;const fetched=[];
 await researchWithAI(inv,async(path,body)=>{
  if(path==='/models')return {data:[{id:'deepseek-flash'}]};
  if(path==='/v1/tools/search'){searchActive++;searchPeak=Math.max(searchPeak,searchActive);await new Promise(r=>setTimeout(r,3));searchActive--;const n=body.query.at(-1);return {results:[{url:'https://noise.org/topics/'+n,title:'Directory'},{url:'https://example.org/profile'+n,title:'casey42 professional profile'}]};}
  if(path==='/v1/tools/fetch'){fetchActive++;fetchPeak=Math.max(fetchPeak,fetchActive);fetched.push(body.url);await new Promise(r=>setTimeout(r,3));fetchActive--;return {content:'A public source records casey42 research projects.'};}
  const prompt=body.messages[1].content;
  if(prompt.startsWith('Plan'))return response({queries:['query1','query2','query3']});
  if(prompt.startsWith('Extract'))return response({claims:data(body).documents.map(d=>({url:d.url,category:'projects',field:'description',value:'research projects',quote:d.content}))});
  return response({sections:[{title:'Overview',paragraphs:[{text:'The source describes public research projects.',evidence_ids:[data(body).evidence[0].id]}]}]});
 },{checkpoint:async()=>{assert.equal(writes++,0);await new Promise(r=>setTimeout(r,2));writes--;}});
 assert.equal(searchPeak,3);assert.ok(fetchPeak>1&&fetchPeak<=3);assert.ok(fetched[0].includes('profile'));assert.equal(fetched.length,5);validateInvestigation(inv);
});
test('DeepSeek planning overlaps independent profile work and uses the returned discovered name',async t=>{
 const {inv}=await base(t,'quick');let planning=false,enriched=false;let release;const barrier=new Promise(r=>{release=r;});const searches=[];
 await researchWithAI(inv,async(path,body)=>{
  if(path==='/models')return {data:[{id:'deepseek-flash'}]};
  if(path==='/v1/tools/search'){searches.push(body.query);return {results:[]};}
  const prompt=body.messages[1].content;
  if(prompt.startsWith('Plan')){planning=true;await barrier;return response({queries:[]});}
  return response({sections:[{title:'Overview',paragraphs:[{text:'The account reports its name.',evidence_ids:[data(body).evidence[0].id]}]}]});
 },{enrichProfiles:async()=>{if(!enriched){assert.equal(planning,true);account(inv);enriched=true;release();}}});
 assert.ok(searches.includes('"Casey Researcher" "casey42"'));assert.equal(inv.input.subject.name,'casey42');
});
test('published professional contacts and general city render with citations; residences, unknown profiles and omissions stay excluded',async t=>{
 const {inv}=await base(t);account(inv);const source=inv.sources[0];
 const content='Casey Researcher. Contact email: casey@example.org. Phone: +1 202 555 0123. Public portfolio.';
 retainPublicContacts(inv,[{source,url:source.url,content}]);
 assert.equal(inv.findings.filter(f=>f.category==='public-contact').length,2);
 const html=renderReport(inv);assert.match(html,/Published contact and general location/);assert.match(html,/casey@example.org/);assert.match(html,/does not authorize unsolicited contact/);
 assert.equal(publicContactAllowed(inv,source.id,'public-contact','general location','Pune','Location: Pune'),true);
 assert.equal(publicContactAllowed(inv,source.id,'public-contact','general location','123 Example Road','Home address: 123 Example Road'),false);
 inv.input.research.omit=['email','location'];assert.equal(publicContactAllowed(inv,source.id,'public-contact','public email','casey@example.org','Contact email: casey@example.org'),false);
 assert.equal(publicContactAllowed(inv,source.id,'public-contact','general location','Pune','Location: Pune'),false);
 assert.doesNotMatch(sanitizeDocumentText('Email: c@example.org\nPhone: +1 202 555 0123\nHome address: 123 Test Road',true),/123 Test Road/);
 assert.match(sanitizeDocumentText('Email: c@example.org\nPhone: +1 202 555 0123',true),/c@example.org/);
 validateInvestigation(inv);
});
test('discovered-name lookups retain their reserved budget after profile follow-up fills its task cap',async t=>{
 const {inv,w}=await base(t);account(inv);let calls=0;
 t.mock.method(HttpClient.prototype,'get',async()=>{calls++;return {data:{items:[],search:[],message:{items:[]}},retrieved_at:inv.created_at,cached:false};});
 const enrich=profileEnricher(inv,w,{});await enrich(['https://github.com/one','https://github.com/two','https://github.com/three']);
 assert.equal(calls,6);await enrich([],researchName(inv));assert.equal(calls,9);await enrich([],researchName(inv));assert.equal(calls,9);
});
test('mixed PDF research preserves eligible published contacts even if narrative does not mention them',async t=>{
 const {inv}=await base(t,'quick');inv.input.subject={name:'Casey Researcher',websites:['https://example.org/cv.pdf']};
 const content='Casey Researcher\nContact email: casey@example.org\nPhone: +1 202 555 0123\nHome address: 123 Example Road';
 let extraction;
 await researchWithAI(inv,async(path,body)=>{
  if(path==='/models')return {data:[{id:'deepseek-flash'}]};if(path==='/v1/tools/search')return {results:[]};
  const prompt=body.messages[1].content;
  if(prompt.startsWith('Plan'))return response({queries:[]});
  if(prompt.startsWith('Extract')){extraction=data(body);return response({claims:[]});}
  return response({sections:[{title:'Overview',paragraphs:[{text:'A public CV reports this name.',evidence_ids:[data(body).evidence[0].id]}]}]});
 },{readDocument:async()=>({content,pages:1,links:[]})});
 assert.match(extraction.documents[0].content,/casey@example.org/);assert.doesNotMatch(extraction.documents[0].content,/123 Example Road/);
 assert.ok(inv.findings.some(f=>f.field==='public email'&&f.value==='casey@example.org'));
 assert.match(renderReport(inv),/Published contact and general location/);validateInvestigation(inv);
});

test('email omission redacts new PDF and web snapshots and DeepSeek prompts', async t => {
 const {inv,w}=await base(t);
 const pdf='https://example.org/cv.pdf', page='https://example.org/profile';
 inv.input.subject={name:'Casey Researcher',websites:[pdf,page]};
 inv.input.research.omit=['email'];
 fact(inv,'previous',page,'employer','Example Labs',{category:'professional',excerpt:'Example Labs. Contact: earlier@example.org'});
 const prompts=[];
 await researchWithAI(inv,async(path,body)=>{
  if(path==='/models') return {data:[{id:'deepseek-flash'}]};
  if(path==='/v1/tools/search') return {results:[]};
  if(path==='/v1/tools/fetch'){
   assert.equal(body.url,page);
   return {content:'Casey Researcher works at Example Labs. Email: web&#64;example.org'};
  }
  prompts.push(...body.messages.map(message=>message.content));
  const prompt=body.messages[1].content;
  if(prompt.startsWith('Plan')) return response({queries:[]});
  if(prompt.startsWith('Extract')) return response({claims:[]});
  if(prompt.startsWith('Review')) return response({queries:[]});
  return response({sections:[{title:'Overview',paragraphs:[{text:'The source lists Example Labs.',evidence_ids:[data(body).evidence[0].id]}]}]});
 },{
  readDocument:async()=>({
   content:'Casey Researcher\nEmail: pdf+work@example.org\nPhone: +1 202 555 0123',
   pages:1,links:['https://example.org/contact?email=link%40example.org','https://example.org/portfolio'],
  }),
  preserveSource:payload=>w.preserveSource(inv.id,payload),
 });
 assert.match(prompts.join('\n'),/\[email omitted\]/);
 assert.doesNotMatch(prompts.join('\n'),/(?:earlier|pdf\+work|web|link)(?:@|%40|&#64;)example\.org/);
 for(const url of [pdf,page]){
  const source=inv.sources.find(s=>s.url===url&&s.snapshot_hash);
  assert.ok(source);
  const snapshot=await w.readObject(inv.id,'snapshots',source.snapshot_hash);
  assert.match(snapshot.content,/\[email omitted\]/);
  assert.doesNotMatch(snapshot.content,/(?:pdf\+work|web|link)(?:@|%40|&#64;)example\.org/);
  if(url===pdf) assert.match(snapshot.content,/\+1 202 555 0123[\s\S]*https:\/\/example\.org\/portfolio/);
  else assert.match(snapshot.content,/Example Labs/);
 }
 assert.ok(!inv.findings.some(f=>f.field==='public email'));
 assert.ok(inv.evidence.some(e=>e.excerpt.includes('earlier@example.org')));
});

test('an employer location is neither a company name nor a company follow-up query',async t=>{
 const {inv}=await base(t);account(inv);const url='https://github.com/casey42/casey42/releases/download/v1/cv.pdf';
 fact(inv,'cv',url,'name','Casey Researcher');fact(inv,'cv',url,'employer','Example Labs',{category:'professional'});
 fact(inv,'cv',url,'employer location','Example City',{category:'professional'});
 assert.ok(matchingQueries(inv).some(q=>q.includes('Example Labs')));assert.ok(!matchingQueries(inv).some(q=>q.includes('Example City')));
 assert.doesNotMatch(renderReport(inv),/<th>Organization<\/th><td>[^]*?Example City[^]*?<\/td>/);
});
