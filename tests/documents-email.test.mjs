import test from 'node:test';
import assert from 'node:assert/strict';
import {Resolver} from 'node:dns/promises';
import {extractPDF,downloadPublicPDF,isPDFResource} from '../dist/adapters/documents.js';
import {checkEmail} from '../dist/legacy-commands/email.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../dist/workspace/index.js';
import {investigate} from '../dist/core/engine.js';
import {researchWithAI} from '../dist/ai/deepseek.js';
import {validateInvestigation} from '../dist/core/schema.js';
function pdf(lines=[],pages=1){
 const objs=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [${Array.from({length:pages},(_,i)=>`${4+i*2} 0 R`).join(' ')}] /Count ${pages} >>`,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`];
 for(let i=0;i<pages;i++){
  const stream='BT /F1 12 Tf 50 750 Td '+lines.map((line,j)=>(j?'0 -16 Td ':'')+'('+line.replace(/[\\()]/g,m=>'\\'+m)+') Tj').join('\n')+' ET';
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
  objs.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
 }
 let out='%PDF-1.4\n',offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(out);out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Uint8Array(Buffer.from(out));
}
test('local PDF extraction reads professional facts across pages and removes email text before AI sharing',async()=>{
 const result=await extractPDF(pdf(['Casey Researcher','Education: Example College','Project: StageKit','Email: private@example.com'],2));
 assert.equal(result.pages,2);assert.match(result.content,/Example College/);assert.match(result.content,/StageKit/);assert.ok(!result.content.includes('private@example.com'));assert.match(result.content,/email omitted/);
});
test('PDF parser has meaningful bounds and fails explicitly for image-only, malformed and over-limit documents',async()=>{
 await assert.rejects(()=>extractPDF(new Uint8Array(Buffer.from('not a pdf'))),/not a PDF/);
 await assert.rejects(()=>extractPDF(pdf([])),/OCR|no extractable text/);
 await assert.rejects(()=>extractPDF(pdf(['Test'],26)),/25-page/);
 await assert.rejects(()=>extractPDF(new Uint8Array(8_000_001)),/8 MB/);
 await assert.rejects(()=>extractPDF(pdf(['Casey']),undefined,1),/timed out/);
 const c=new AbortController();c.abort();await assert.rejects(()=>extractPDF(pdf(['Test']),c.signal),{name:'AbortError'});
});
test('public document download rejects private destinations before making an HTTPS request',async t=>{
 t.mock.method(Resolver.prototype,'resolve4',async()=>['127.0.0.1']);
 await assert.rejects(()=>downloadPublicPDF('https://example.org/cv.pdf'),/nonpublic/);
 await assert.rejects(()=>downloadPublicPDF('http://example.org/cv.pdf'),/public HTTPS/);
 assert.equal(isPDFResource('https://example.org/resume.pdf?download=1'),true);assert.equal(isPDFResource('https://example.org/cv'),true);assert.equal(isPDFResource('https://example.org/about'),false);
});
test('long public documents are chunked and late facts extracted without losing same-URL parts',async t=>{
 const root=await mkdtemp(join(tmpdir(),'phomber-doc-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const inv=await investigate({schema_version:'1.0',subject:{name:'Casey Researcher',websites:['https://example.org/cv.pdf']},research:{offline:true,depth:'quick'}},new Workspace(root));
 inv.sources=[];inv.tasks=[];inv.evidence=[];inv.input.research.offline=false;
 const content='Casey Researcher studied at Example College.\n'+('Public professional notes.\n'.repeat(1500))+'Casey Researcher created StageKit.';
 let local=0,remote=0;const response=o=>({choices:[{message:{content:JSON.stringify(o)}}]});
 await researchWithAI(inv,async(path,body)=>{
  if(path==='/models')return {data:[{id:'deepseek-flash'}]};if(path==='/v1/tools/search')return {results:[]};
  if(path==='/v1/tools/fetch'){remote++;throw Error('PDF should use local extraction');}
  const prompt=body.messages[1].content,data=JSON.parse(prompt.split('\nUNTRUSTED RESEARCH DATA:\n')[1]);
  if(prompt.startsWith('Plan'))return response({queries:[]});
  if(prompt.startsWith('Extract'))return response({claims:data.documents.flatMap(d=>[
   ...(d.content.includes('Casey Researcher studied at Example College.')?[{url:d.url,category:'education',field:'institution',value:'Example College',quote:'Casey Researcher studied at Example College.'}]:[]),
   ...(d.content.includes('Casey Researcher created StageKit.')?[{url:d.url,category:'projects',field:'project title',value:'StageKit',quote:'Casey Researcher created StageKit.'}]:[])])});
  return response({sections:[{title:'Projects',paragraphs:[{text:'A candidate CV reports StageKit.',evidence_ids:[data.evidence.find(e=>e.value==='StageKit').id]}]}]});
 },{readDocument:async()=>{local++;return {content,pages:3,links:[]};}});
 assert.equal(local,1);assert.equal(remote,0);assert.ok(inv.findings.some(f=>f.value==='StageKit'));assert.ok(inv.findings.some(f=>f.value==='Example College'));assert.equal(inv.sources[0].adapter,'local-pdf');assert.equal(inv.sources[0].pages,3);validateInvestigation(inv);
});
function dns({mx=[],v4=[],v6=[],error}={}){let calls=0;return {get calls(){return calls;},resolveMx:async domain=>{calls++;if(error)throw Object.assign(Error('DNS fixture'),{code:error});return mx;},resolve4:async()=>v4,resolve6:async()=>v6,cancel(){}};}
test('email checks mask the address and report DNS support without asserting mailbox ownership or leaks',async()=>{
 const resolver=dns({mx:[{priority:10,exchange:'mx.example.com'}]});const r=await checkEmail('owner+tag@example.com',undefined,resolver);
 assert.equal(r.email,'o***@example.com');assert.equal(r.syntax,'supported');assert.equal(r.mail_domain,'mx-records-present');assert.equal(r.mailbox_exists,'unknown');assert.equal(r.owner_identity,'unverified');assert.equal(r.breach_status,'not-checked');assert.match(r.notice,/own email|authorized/);assert.equal(resolver.calls,1);
});
test('email check handles null MX, implicit MX, invalid syntax, public suffixes and DNS failures',async()=>{
 assert.equal((await checkEmail('me@example.com',undefined,dns({mx:[{priority:0,exchange:'.'}],v4:['1.1.1.1']}))).mail_domain,'explicitly-does-not-accept-mail');
 assert.equal((await checkEmail('me@example.com',undefined,dns({error:'ENODATA',v4:['1.1.1.1']}))).mail_domain,'implicit-mx-address-records-present');
 assert.equal((await checkEmail('me@example.com',undefined,dns({error:'ETIMEOUT'}))).mail_domain,'dns-unavailable');
 assert.equal((await checkEmail('me@example.com',undefined,dns({error:'ENOTFOUND'}))).mail_domain,'domain-not-found');
 const resolver=dns();assert.equal((await checkEmail('bad..mail@example.com',undefined,resolver)).syntax,'invalid-or-unsupported');assert.equal(resolver.calls,0);
 assert.equal((await checkEmail('me@internal.local',undefined,resolver)).mail_domain,'non-public-or-unknown-suffix');assert.equal(resolver.calls,0);
});
