import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const html=await readFile(new URL('../website/index.html',import.meta.url),'utf8');
const source=html.match(/<script id="site-search-engine">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'The single HTML must contain its actual search engine');
const window={};runInNewContext(source,{window,URLSearchParams});
const {prepare,search,parseRoute,commandKeywords}=window.PhomberSiteSearch;
const text=value=>value.replace(/<[^>]*>/g,' ').replaceAll('&amp;','&').replaceAll('&quot;','"').replace(/\s+/g,' ').trim();
const docs=[...html.matchAll(/<tr id="(command-\d+)" data-kind="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)].map(([,id,kind,body])=>{const title=text(body.match(/<code>([\s\S]*?)<\/code>/)[1]);return {id,kind:'command',title,text:text(body),keywords:commandKeywords(title)};});
docs.push(...[...html.matchAll(/<(?:article|p|div)[^>]*id="([^"]+)"[^>]*data-search-item[^>]*data-search-title="([^"]+)"[^>]*data-search-keywords="([^"]+)"[^>]*>([\s\S]*?)<\/(?:article|p|div)>/g)].map(([,id,title,keywords,body])=>({id,title:text(title),keywords,text:text(body),kind:'topic'})));
const index=prepare(docs);
test('the actual inline search ranks canonical command names above weaker related matches',()=>{
 assert.equal(search(index,'serve')[0].title,'phomber serve');
 assert.equal(search(index,'reprots')[0].title,'phomber reports');
 assert.equal(search(index,'servr')[0].title,'phomber serve');
 assert.deepEqual(Array.from(search(index,'remove report').filter(result=>result.kind==='command'),result=>result.title),['phomber reports delete REPORT_ID']);
});
test('site search handles word order, related words, accents, fullwidth forms and prefixes',()=>{
 assert.ok(search(index,'report remove').some(result=>result.title.includes('reports delete')));
 assert.ok(search(index,'server').some(result=>result.title==='phomber serve'));
 assert.equal(search(index,'ＳＥＲＶＥ')[0].title,'phomber serve');
 assert.ok(search(index,'résumé').some(result=>result.id==='evidence-pdf'));
 assert.ok(search(index,'comapny').some(result=>result.id==='roadmap-company'));
 assert.ok(search(index,'deep').some(result=>result.id==='guide-deep'));
});
test('planned company and privacy work is searchable without claiming it is implemented',()=>{
 assert.ok(search(index,'business').some(result=>result.id==='roadmap-company'));
 assert.ok(search(index,'email leaks').some(result=>result.id==='roadmap-privacy'));
 assert.match(html,/page\.dataset\.page==='roadmap'/);
 assert.match(html,/Planned feature/);
});
test('empty, stopword-only, long and meaningless searches stay bounded and short tokens are not fuzzy',()=>{
 assert.equal(search(index,'').length,0);assert.equal(search(index,'how do i').length,0);
 assert.equal(search(index,'zxqv999999').length,0);
 assert.ok(search(index,'x'.repeat(10000)).length<=40);
 const short=prepare([{title:'API',text:'API',keywords:'',kind:'topic'}]);assert.equal(search(short,'ip').length,0);
});
test('single-file routes preserve legacy bookmarks and shareable query/anchor state',()=>{
 assert.equal(parseRoute('').page,'home');assert.equal(parseRoute('#commands').page,'commands');assert.equal(parseRoute('#start').page,'guide');
 assert.equal(parseRoute('#/faq#faq-3').anchor,'faq-3');
 assert.equal(parseRoute('#/search?q=delete%20report').query,'delete report');
 assert.equal(parseRoute('#/roadmap').page,'roadmap');
 assert.doesNotThrow(()=>parseRoute('#/%E0%A4%A'));
 assert.equal(parseRoute('#/search?q='+encodeURIComponent('<img onerror=alert(1)>')).query,'<img onerror=alert(1)>');
});
test('page shell keeps the light single-file fallback and routed views',()=>{
 for(const page of ['home','guide','commands','evidence','faq','roadmap','about','search','not-found'])assert.ok(html.includes(`data-page="${page}"`));
 assert.ok(html.includes('backups')===false);
 assert.match(html,/<noscript>/);assert.match(html,/history\.replaceState/);assert.match(html,/hashchange/);
 assert.match(html,/details\.open=true/);assert.ok(!html.includes("host.innerHTML"));
});
