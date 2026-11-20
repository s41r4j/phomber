import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../dist/workspace/index.js';
import {investigate,addFinding} from '../dist/core/engine.js';
import {buildPlan} from '../dist/adapters/index.js';
import {matchAuthorName,matchingAuthors,publicationAttribution,articleTimeline} from '../dist/core/publications.js';
import {identitySupport,researchEvidence,researchLeads} from '../dist/core/research.js';
import {safeArticleSections,validateArticleSections} from '../dist/core/article.js';
import {makeReview} from '../dist/core/trust.js';
import {validateInvestigation} from '../dist/core/schema.js';
import {researchWithAI} from '../dist/ai/deepseek.js';
import {renderReport} from '../dist/reports/html.js';
const subject={name:'Amol Chaudhari',education:[{institution:'PDEA College'}]};
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'phomber-author-'));t.after(()=>rm(root,{recursive:true,force:true}));const inv=await investigate({schema_version:'1.0',subject,research:{offline:true}},new Workspace(root));inv.sources=[];inv.tasks=[];return inv;}
function paper(inv,{doi='10.1234/example',authors=[{given:'Amol',family:'Chaudhari'}],title='Candidate work'}={}){
 let source=inv.sources.find(s=>s.id==='crossref');if(!source){source={id:'crossref',adapter:'crossref',url:'https://api.crossref.org/works?query.author=Amol%20Chaudhari',status:'ok',retrieved_at:inv.created_at};inv.sources.push(source);}
 addFinding(inv,{category:'publications',field:title,value:'https://doi.org/'+doi,identity:'candidate',excerpt:JSON.stringify({title:[title],authors,DOI:doi}),date:{start:'2022',precision:'year'}},source);
 const finding=inv.findings.find(f=>f.value==='https://doi.org/'+doi),evidence=inv.evidence.find(e=>e.finding_id===finding.id);return {finding,evidence};
}
const wrong=[{given:'Dhanashri',family:'Chaudhari'},{given:'Amol',family:'Kharat'}];
test('one individual author must match; given/family names from co-authors are never combined',()=>{
 assert.equal(matchingAuthors(subject,wrong).length,0);
 assert.equal(matchAuthorName(subject,{given:'Amol',family:'Kharat'}),'different');
 assert.equal(matchAuthorName(subject,{given:'Dhanashri',family:'Chaudhari'}),'different');
 assert.equal(matchAuthorName(subject,{given:'Amol',family:'Chaudhary'}),'different');
 assert.equal(matchAuthorName(subject,{given:'Amol',family:'Chaudhari'}),'exact');
 assert.equal(matchAuthorName(subject,{given:'Amol S.',family:'Chaudhari'}),'middle-variant');
 assert.equal(matchAuthorName(subject,{given:'Amol Chaudhari, Shabbir Bohra',family:''}),'insufficient');
 assert.equal(matchAuthorName(subject,{given:'A.',family:'Chaudhari'}),'insufficient');
});
test('Crossref collection excludes unrelated co-author combinations before creating findings or timeline entries',()=>{
 const task=buildPlan({schema_version:'1.0',subject,research:{depth:'standard'}}).tasks.find(t=>t.adapter==='crossref');
 const records=task.parse({message:{items:[{title:['Wrong work'],URL:'https://doi.org/10.1234/wrong',DOI:'10.1234/wrong',author:wrong},{title:['Same-name candidate'],URL:'https://doi.org/10.1234/candidate',DOI:'10.1234/candidate',author:[{given:'Amol',family:'Chaudhari'},{given:'Another',family:'Person'}],published:{'date-parts':[[2023]]}}]}});
 assert.equal(records.length,1);assert.equal(records[0].field,'Same-name candidate');assert.equal(records[0].date.start,'2023');
});
test('a legacy mismatched author record is excluded from research, leads and identity marks',async t=>{
 const inv=await fixture(t),{finding}=paper(inv,{authors:wrong});
 const a=publicationAttribution(inv,finding);assert.equal(a.state,'different-authors');assert.equal(a.research,false);assert.equal(a.article,false);
 assert.equal(researchEvidence(inv).length,0);assert.equal(researchLeads(inv).length,0);
 const support=identitySupport(inv)[0];assert.equal(support.state,'discovery-only');assert.equal(support.score,0);assert.equal(support.expand,false);
});
test('even an exact full author name remains evidence-only until subject-specific linkage exists',async t=>{
 const inv=await fixture(t),{finding,evidence}=paper(inv);
 assert.equal(publicationAttribution(inv,finding).state,'author-name-only');assert.equal(researchEvidence(inv).length,1);
 assert.throws(()=>validateArticleSections({sections:[{title:'Publications',paragraphs:[{text:'The subject wrote this paper.',evidence_ids:[evidence.id]}]}]},inv),/unsupported evidence citations/);
 let calls=0;await researchWithAI(inv,async path=>{if(path==='/models')return {data:[{id:'deepseek-flash'}]};calls++;throw Error('No unlinked bibliography synthesis expected');},{synthesisOnly:true});
 assert.equal(calls,0);assert.equal(inv.ai.sections.length,0);assert.equal(inv.status,'partial');
});
test('safe legacy rendering removes unsupported publication rows, paragraphs and timeline without rewriting raw evidence',async t=>{
 const inv=await fixture(t),bad=paper(inv,{authors:wrong,title:'Unrelated antioxidant paper'}),candidate=paper(inv,{doi:'10.1234/same-name',title:'Same-name unresolved paper'});
 const source={id:'profile',adapter:'fixture',url:'https://example.org/profile',status:'ok',retrieved_at:inv.created_at};inv.sources.push(source);addFinding(inv,{category:'projects',field:'Project',value:'Example Project',identity:'candidate',excerpt:'The candidate profile lists Example Project.'},source);
 const project=inv.evidence.find(e=>e.source_id==='profile');
 inv.ai={model:'fixture',status:'complete',limitations:[],sections:[{title:'Projects',paragraphs:[{text:'A candidate lists Example Project.',evidence_ids:[project.id]}]},{title:'Publications associated with the name',paragraphs:[],blocks:[{type:'paragraph',text:'A mixed claim about these papers.',evidence_ids:[bad.evidence.id,project.id]},{type:'table',columns:['Recorded author'],rows:[{cells:['Amol Kharat (different surname arrangement)'],evidence_ids:[bad.evidence.id]},{cells:['Amol Chaudhari'],evidence_ids:[candidate.evidence.id]}]}]}]};
 const before=JSON.stringify(inv);validateInvestigation(inv);const safe=safeArticleSections(inv);assert.equal(safe.length,1);assert.equal(safe[0].title,'Projects');assert.equal(articleTimeline(inv).length,0);
 const html=renderReport(inv);assert.ok(!html.includes('different surname arrangement'));assert.ok(!html.includes('Unrelated antioxidant paper'));assert.match(html,/Example Project/);assert.equal(JSON.stringify(inv),before);
 assert.ok(inv.evidence.some(e=>e.excerpt.includes('Kharat')));
});
test('only the matching author ORCID can connect a work to a supplied ORCID',async t=>{
 const inv=await fixture(t);inv.input.subject.socials=[{platform:'orcid',username:'0000-0001-2345-6789'}];
 const one=paper(inv,{authors:[{given:'Amol',family:'Chaudhari',ORCID:'https://orcid.org/0000-0002-3456-7890'},{given:'Other',family:'Author',ORCID:'https://orcid.org/0000-0001-2345-6789'}]});
 assert.equal(publicationAttribution(inv,one.finding).article,false);
 const two=paper(inv,{doi:'10.1234/linked',authors:[{given:'Amol',family:'Chaudhari',ORCID:'https://orcid.org/0000-0001-2345-6789'}]});
 assert.equal(publicationAttribution(inv,two.finding).state,'linked-publication');assert.equal(publicationAttribution(inv,two.finding).article,true);
});
test('a same-work DOI from a supplied/reviewed publication resource can provide linkage, but an unrelated DOI cannot',async t=>{
 const inv=await fixture(t),one=paper(inv),two=paper(inv,{doi:'10.1234/unlinked'});
 const source={id:'profile',adapter:'fixture',url:'https://example.org/profile',status:'ok',retrieved_at:inv.created_at};inv.sources.push(source);
 addFinding(inv,{category:'publications',field:'Listed publication',value:one.finding.value,identity:'anchored',excerpt:'This supplied profile lists '+one.finding.value},source);
 assert.equal(publicationAttribution(inv,one.finding).article,true);assert.equal(publicationAttribution(inv,two.finding).article,false);
});
test('review decisions cannot override a contradictory per-work author list without explicit name evidence',async t=>{
 const inv=await fixture(t),bad=paper(inv,{authors:wrong});inv.reviews=[makeReview(inv,bad.finding.id,{decision:'accepted',identity:'matched',reason:'Incorrect fixture assumption.',analyst:'Fixture analyst'})];
 assert.equal(publicationAttribution(inv,bad.finding).article,false);
});
test('strict narrative validation cannot cite eligible evidence that was not sent to the model',async t=>{
 const inv=await fixture(t);const source={id:'source',adapter:'fixture',url:'https://example.org/profile',status:'ok',retrieved_at:inv.created_at};inv.sources.push(source);addFinding(inv,{category:'projects',field:'Project',value:'Example Project',identity:'candidate'},source);
 const id=inv.evidence[0].id;assert.throws(()=>validateArticleSections({sections:[{title:'Projects',paragraphs:[{text:'A candidate project.',evidence_ids:[id]}]}]},inv,{allowedEvidenceIDs:new Set()}),/unsupported evidence/);
});
