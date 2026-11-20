import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../dist/workspace/index.js';
import {investigate,addFinding} from '../dist/core/engine.js';
import {identitySupport,researchLeads,matchingQueries,resourceURL} from '../dist/core/research.js';
import {provenanceGraph} from '../dist/reports/workbench.js';
import {makeReview} from '../dist/core/trust.js';
import {renderReport} from '../dist/reports/html.js';
async function base(t){const root=await mkdtemp(join(tmpdir(),'phomber-marks-'));t.after(()=>rm(root,{recursive:true,force:true}));const w=new Workspace(root);const inv=await investigate({schema_version:'1.0',subject:{name:'Casey Researcher',education:[{institution:'Example College'}],socials:[{platform:'github',username:'casey'}]},research:{offline:true}},w);inv.sources=[];inv.tasks=[];return inv;}
function fact(inv,id,url,category,field,value,excerpt=value,adapter='fixture'){
 let s=inv.sources.find(s=>s.id===id);if(!s){s={id,url,adapter,status:'ok',retrieved_at:inv.created_at};inv.sources.push(s);}
 addFinding(inv,{category,field,value,excerpt,identity:'candidate'},s);return inv.findings.find(f=>f.source_ids.includes(id)&&f.field===field&&f.value===value);
}
function profile(inv,id,url,{employer=true,project=true,qualification=false}={}){
 fact(inv,id,url,'identity','name','Casey Researcher','Casey Researcher publishes this professional profile.');
 fact(inv,id,url,'education','institution','Example College','Casey Researcher studied at Example College.');
 if(employer)fact(inv,id,url,'professional','employer','Example Labs','Casey Researcher works at Example Labs.');
 if(project)fact(inv,id,url,'projects','project title','StageKit','Casey Researcher created StageKit.');
 if(qualification)fact(inv,id,url,'achievements','qualification','Example Certificate','Casey Researcher earned Example Certificate.');
}
test('several distinct matching facts connect a CV with an independently published profile and expand research',async t=>{
 const inv=await base(t);profile(inv,'cv','https://example.org/cv.pdf');profile(inv,'profile','https://github.com/casey');
 fact(inv,'cv','https://example.org/cv.pdf','online','public project link','https://gitlab.com/casey-stage','Public project link: https://gitlab.com/casey-stage');
 const cv=identitySupport(inv).find(s=>s.source_id==='cv');
 assert.equal(cv.state,'probable-match');assert.equal(cv.score,85);assert.equal(cv.independent_sources,2);assert.equal(cv.expand,true);
 assert.deepEqual(cv.signals.map(s=>s.kind).sort(),['education','employer','name','project']);
 assert.equal(cv.score_kind,'heuristic-marks-not-probability');assert.ok(cv.signals.every(s=>s.evidence_ids.length&&s.source_ids.length));
 assert.ok(matchingQueries(inv).some(q=>q.includes('stagekit')));
 assert.equal(researchLeads(inv).find(l=>l.url==='https://gitlab.com/casey-stage').action,'expand');
 assert.ok(provenanceGraph(inv).identity_matches.some(s=>s.source_id==='cv'&&s.score===85));
 assert.match(renderReport(inv),/85 evidence marks/);
});
test('matching marks grow with distinct corroborated clues, while extra copies do not inflate the score',async t=>{
 const inv=await base(t);profile(inv,'cv','https://example.org/cv.pdf',{employer:false,project:false});profile(inv,'web','https://another.edu/person',{employer:false,project:false});
 fact(inv,'web','https://another.edu/person','professional','biography','Public reviewer','Casey Researcher publishes independent public event reviews.');
 const before=identitySupport(inv).find(s=>s.source_id==='cv');assert.equal(before.score,40);assert.equal(before.expand,false);
 for(const [id,url]of[['cv','https://example.org/cv.pdf'],['web','https://another.edu/person']])fact(inv,id,url,'projects','project title','StageKit','Casey Researcher created StageKit.');
 assert.equal(identitySupport(inv).find(s=>s.source_id==='cv').score,65);
 for(const [id,url]of[['cv','https://example.org/cv.pdf'],['web','https://another.edu/person']])fact(inv,id,url,'timeline','graduation year','2024','Casey Researcher graduation year: 2024.');
 assert.equal(identitySupport(inv).find(s=>s.source_id==='cv').score,73);
 profile(inv,'mirror','https://mirror.example.org/cv.pdf',{employer:false});
 assert.equal(identitySupport(inv).find(s=>s.source_id==='cv').score,73);
});
test('identical CV mirrors and same-publisher subdomains cannot provide independent confirmation',async t=>{
 const inv=await base(t);inv.input.subject.socials=[];
 profile(inv,'one','https://one.example.co.uk/cv');profile(inv,'two','https://two.example.co.uk/profile');profile(inv,'copy','https://different.org/cv');
 for(const support of identitySupport(inv)){assert.equal(support.independent_sources,1);assert.equal(support.score,40);assert.notEqual(support.state,'probable-match');assert.equal(support.expand,false);}
});
test('name or handle agreement alone does not authorize expansion and unrelated sources cannot lend facts',async t=>{
 const inv=await base(t);inv.input.subject.socials=[];inv.input.subject.usernames=['casey'];
 for(const [id,url]of[['one','https://one.example.org'],['two','https://different.org']]){
 fact(inv,id,url,'identity','name','Casey Researcher','Casey Researcher uses the public handle casey.');
 }
 fact(inv,'wrong','https://elsewhere.net','identity','name','Another Person','Another Person uses public handle casey.');
 fact(inv,'wrong','https://elsewhere.net','professional','employer','Example Labs','Another Person works at Example Labs.');
 for(const support of identitySupport(inv).filter(s=>s.source_id!=='wrong')){assert.equal(support.score,28);assert.equal(support.expand,false);assert.ok(!support.matched_source_ids.includes('wrong'));}
 assert.equal(identitySupport(inv).find(s=>s.source_id==='wrong').state,'conflicting');
});
test('negative identity review vetoes expansion despite many matching marks',async t=>{
 const inv=await base(t);profile(inv,'one','https://example.org/cv');profile(inv,'two','https://github.com/casey',{qualification:true});
 const f=inv.findings.find(f=>f.source_ids.includes('one')&&f.field==='name');
 inv.reviews=[makeReview(inv,f.id,{decision:'rejected',identity:'different',reason:'A different person confirmed.',analyst:'Fixture'})];
 const one=identitySupport(inv).find(s=>s.source_id==='one');assert.equal(one.state,'conflicting');assert.equal(one.expand,false);assert.ok(one.score<70);
});
test('generic skill words and multi-person source pages are not strong identity matches',async t=>{
 const inv=await base(t);inv.input.subject.socials=[];
 profile(inv,'one','https://example.org/team');profile(inv,'two','https://different.org/profile');
 fact(inv,'one','https://example.org/team','identity','name','Another Person','Another Person also appears on this team page.');
 const one=identitySupport(inv).find(s=>s.source_id==='one');assert.equal(one.expand,false);assert.ok(one.reasons.some(s=>s.includes('Several different names')));
 fact(inv,'skill','https://skills.net/casey','identity','name','Casey Researcher','Casey Researcher uses Python and JavaScript.');
 fact(inv,'skill','https://skills.net/casey','projects','project','Python','Casey Researcher uses Python.');
 assert.ok(!identitySupport(inv).find(s=>s.source_id==='skill').signals.some(s=>s.kind==='project'));
});
test('canonical resource URLs retain identity query parameters and normalize supported account APIs',()=>{
 assert.notEqual(resourceURL('https://example.org/person?id=1'),resourceURL('https://example.org/person?id=2'));
 assert.equal(resourceURL('https://dev.to/api/users/by_username?url=casey'),'https://dev.to/casey');
 assert.equal(resourceURL('https://gitlab.com/api/v4/users?username=casey'),'https://gitlab.com/casey');
 assert.equal(resourceURL('https://example.org/profile?utm_source=test#about'),'https://example.org/profile');
});

test('generic project field labels cannot create a match between differently named projects',async t=>{
 const inv=await base(t);inv.input.subject.socials=[];
 for(const [id,url,value]of[['one','https://example.org/cv','StageKit'],['two','https://different.org/profile','AnotherProject']]){
  fact(inv,id,url,'identity','name','Casey Researcher','Casey Researcher publishes this profile.');
  fact(inv,id,url,'projects','project_name',value,`Casey Researcher created ${value}.`);
 }
 for(const result of identitySupport(inv)){assert.ok(!result.signals.some(s=>s.kind==='project'));assert.equal(result.expand,false);}
});
