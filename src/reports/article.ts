import { articleText, ARTICLE_TEMPLATE, type ArticleBlock } from "../core/article.js";
import { escape, link, page, appearance, researchMeta } from "./shell.js";
import { reportTitle } from "../catalog/index.js";
import type { Investigation, Finding } from "../core/types.js";
export function dateTime(value?: string): string {
    if (!value)
        return "Not recorded";
    const n = Date.parse(value);
    return Number.isFinite(n)
        ? new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "long",
            timeZone: "Asia/Kolkata",
        }).format(new Date(n))
        : "Not recorded";
}
export function articleTabs(id: string, active = "Article"): string {
    const base = "/reports/" + id + "/";
    return `<div class="article-tools"><div class="tabs"><a class="${active === "Article" ? "active" : ""}" href="${base}">Article</a><a class="${active === "Evidence" ? "active" : ""}" href="${base}evidence/">Evidence</a><a class="${active === "Page information" ? "active" : ""}" href="${base}info/">Page information</a></div><div class="tabs"><a href="${base}profile.json">View data</a><a href="${base}history/">Versions</a><a href="/admin/">Manage wiki</a></div></div>`;
}
const titles = [
    "Education",
    "Career",
    "Certifications",
    "Selected projects",
    "Achievements",
    "Technical writing and publications",
    "Public profiles",
    "Identity and verification",
    "Timeline",
    "Research limitations",
];
function sectionTitle(title: string): string {
    if (/overview|biography|introduction/i.test(title))
        return "Overview";
    if (/education|academic/i.test(title))
        return "Education";
    if (/certif|course/i.test(title))
        return "Certifications";
    if (/career|professional|employment/i.test(title))
        return "Career";
    if (/project|software|contribution/i.test(title))
        return "Selected projects";
    if (/publication|writ|media/i.test(title))
        return "Technical writing and publications";
    if (/presence|online|social|profile/i.test(title))
        return "Public profiles";
    if (/identity|verif/i.test(title))
        return "Identity and verification";
    if (/timeline|chronolog/i.test(title))
        return "Timeline";
    if (/limit|uncertain|research note/i.test(title))
        return "Research limitations";
    return title;
}
const sectionId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export function renderBiography(inv: Investigation, profileURL?: string, version?: number): string {
    const name = reportTitle(inv), handle = inv.input.subject.usernames?.[0] ||
        inv.input.subject.socials?.[0]?.username;
    const referenced: string[] = [];
    const refs = (sourceIds: string[]) => `<sup class="reference">${[...new Set(sourceIds)]
        .filter((id) => inv.sources.some((s) => s.id === id))
        .map((id) => {
        if (!referenced.includes(id))
            referenced.push(id);
        return `<a href="#source-${escape(id)}">[${referenced.indexOf(id) + 1}]</a>`;
    })
        .join("")}</sup>`;
    const evidenceRefs = (ids: string[]) => refs(ids.flatMap((id) => {
        const e = inv.evidence.find((e) => e.id === id);
        return e ? [e.source_id] : [];
    }));
    const portraitRefs = inv.portrait ? refs([inv.portrait.source_id]) : "";
    const compact = (items: Finding[], limit = 3) => {
        const unique = new Map<string, Finding>();
        for (const f of items) {
            const key = f.value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
            const existing = unique.get(key);
            if (existing)
                existing.source_ids = [
                    ...new Set([...existing.source_ids, ...f.source_ids]),
                ];
            else
                unique.set(key, { ...f, source_ids: [...f.source_ids] });
        }
        return [...unique.values()]
            .slice(0, limit)
            .map((f) => {
            let value = f.value;
            try {
                const record = JSON.parse(value);
                if (record && typeof record === "object" && !Array.isArray(record))
                    value =
                        [
                            record.institution || record.name || record.title,
                            record.degree,
                            record.field_of_study,
                        ]
                            .filter((v) => typeof v === "string")
                            .join(" · ") || value;
            }
            catch { }
            return `${escape(value)}${refs(f.source_ids)}${f.status === "lead" ? " <small>(profile-reported)</small>" : ""}`;
        })
            .join("<br>");
    };
    const findings = (pattern: RegExp) => inv.findings.filter((f) => pattern.test(f.field.replace(/_/g, " ")) &&
        f.value.length < 240 &&
        f.field !== "type");
    const rows: [
        string,
        string
    ][] = [];
    if (handle)
        rows.push(["Base username", escape(handle)]);
    const known = inv.input.subject.aliases || [];
    if (known.length)
        rows.push(["Also known as", known.map(escape).join(", ")]);
    const occupations = findings(/occupation|job title|professional title|headline|^role$/i);
    if (occupations.length)
        rows.push(["Occupation", compact(occupations)]);
    const companies = inv.findings.filter((f) => f.category === "professional" &&
        /company|employer|organization/i.test(f.field) &&
        f.value.length < 200);
    if (companies.length)
        rows.push(["Organization", compact(companies)]);
    else if (inv.input.subject.professional?.company)
        rows.push([
            "Organization",
            escape(inv.input.subject.professional.company) +
                " <small>(supplied)</small>",
        ]);
    const education = inv.findings.filter((f) => f.category === "education" && f.value.length < 250);
    if (education.length)
        rows.push(["Education", compact(education)]);
    else if (inv.input.subject.education?.length)
        rows.push([
            "Education",
            inv.input.subject.education
                .map((e) => escape(e.institution || e.name || ""))
                .join("<br>") + " <small>(supplied)</small>",
        ]);
    const country = findings(/^country$/i);
    if (country.length)
        rows.push(["Country", compact(country, 1)]);
    const skills = findings(/^skills$|^skills summary$/i);
    if (skills.length)
        rows.push(["Specialisms", compact(skills, 1)]);
    const certifications = findings(/certification|certificate|credential title/i);
    if (certifications.length)
        rows.push(["Certifications", compact(certifications)]);
    const birth = findings(/^date of birth$|^birth date$/i);
    if (birth.length)
        rows.push(["Born", compact(birth, 1)]);
    const location = inv.input.subject.location;
    if (location)
        rows.push([
            "General location",
            escape(location) + " <small>(supplied)</small>",
        ]);
    const websites = inv.findings.filter((f) => f.category !== "projects" &&
        f.category !== "project" &&
        /website/i.test(f.field) &&
        /^https:\/\/\S+$/.test(f.value));
    if (websites.length)
        rows.push([
            "Website",
            websites
                .slice(0, 2)
                .map((f) => link(f.value) + refs(f.source_ids))
                .join("<br>"),
        ]);
    const projectSection = inv.ai?.sections.find(s => /project/i.test(s.title));
    const proseText = articleText(projectSection ? [projectSection] : inv.ai?.sections || []).toLowerCase();
    const projectMap = new Map<string, Finding>();
    for (const original of inv.findings.filter(f => f.category === 'projects' && !/config files for my github profile|profile configuration/i.test(f.value))) {
        let label = original.field;
        if (/^(project|repository|repo|name)$/i.test(label)) {
            const repository = original.value.match(/https:\/\/(?:www\.)?(?:github\.com|gitlab\.com)\/[^\s/]+\/([^\s/#?]+)/i)?.[1];
            label = repository || original.value.replace(/^.*?\s+\/\s+/, '').split(/\s+[|:]/)[0]!.trim();
            if (label.length > 100)
                continue;
        }
        const key = label.toLowerCase().replace(/[^a-z0-9]/g, '');
        const existing = projectMap.get(key);
        if (existing)
            existing.source_ids = [...new Set([...existing.source_ids, ...original.source_ids])];
        else
            projectMap.set(key, { ...original, field: label, source_ids: [...original.source_ids] });
    }
    const selected = [...projectMap.values()].sort((a, b) => {
        const position = (name: string) => {
            const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const descriptive = new RegExp('(?:^|[^a-z0-9])' + escaped + '(?:,?\\s+(?:described|an?\\s)|\\s*\\()').exec(proseText);
            if(descriptive) return descriptive.index;
            const match = new RegExp('(?:^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])').exec(proseText);
            return match ? 1000000+match.index : Number.MAX_SAFE_INTEGER;
        };
        return position(a.field) - position(b.field);
    }).slice(0, 8);
    const projectTarget = projectSection?.blocks ? sectionId(projectSection.title) : "selected-projects";
    if (selected.length)
        rows.push(['Notable projects', selected.slice(0, 4).map(f => `<a href="#${projectTarget}">${escape(f.field)}</a>`).join(', ')]);
    const photo = inv.findings.find((f) => /profile (image|photo)|portrait/i.test(f.field) &&
        /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(f.value));
    const infobox = `<aside class="infobox biography-infobox" aria-label="Profile information"><div class="infobox-title">${escape(name)}</div>${handle ? `<div class="infobox-subtitle">${escape(handle)}</div>` : ""}${inv.portrait ? `<div class="infobox-image"><img src="${escape(inv.portrait.data_url)}" alt="Portrait from cited public profile"><div class="image-caption">Portrait from the cited candidate profile.${portraitRefs}<br>Portrait retrieved ${escape(dateTime(inv.portrait.retrieved_at))}</div></div>` : photo ? `<div class="infobox-image"><img src="${escape(photo.value)}" alt="Source-provided portrait of ${escape(name)}"><div class="image-caption">Source-provided portrait${refs(photo.source_ids)}</div></div>` : ""}<table><tbody>${rows.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join("")}<tr><th>Identity status</th><td>${inv.findings.some((f) => f.identity === "candidate") ? "Candidate account links; human review required" : "Source attribution recorded"}</td></tr><tr><th>Last researched</th><td>${escape(dateTime(inv.research_timing?.finished_at || inv.updated_at))}</td></tr></tbody></table></aside>`;
    const renderBlock = (b: ArticleBlock): string => {
        if (b.type === 'paragraph')
            return `<p data-search>${escape(b.text)}${evidenceRefs(b.evidence_ids)}</p>`;
        if (b.type === 'quote')
            return `<blockquote data-search>${escape(b.text)}${evidenceRefs(b.evidence_ids)}</blockquote>`;
        if (b.type === 'subheading')
            return `<h3>${escape(b.title)}</h3>`;
        if (b.type === 'list') {
            const tag = b.ordered ? 'ol' : 'ul';
            return `<${tag}>${b.items.map(i => `<li data-search>${escape(i.text)}${evidenceRefs(i.evidence_ids)}</li>`).join('')}</${tag}>`;
        }
        return `<div class="table-scroll"><table class="wikitable">${b.caption ? `<caption>${escape(b.caption)}</caption>` : ''}<thead><tr>${b.columns.map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr data-search>${r.cells.map((c, i) => `<td>${escape(c)}${i === r.cells.length - 1 ? evidenceRefs(r.evidence_ids) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    };
    const dynamic = inv.ai?.sections.some(s => s.blocks?.length);
    const sections = new Map<string, string[]>();
    for (const s of inv.ai?.sections || []) {
        const title = dynamic ? (/^(overview|introduction|biography)$/i.test(s.title) ? 'Overview' : s.title) : sectionTitle(s.title);
        sections.set(title, [...(sections.get(title) || []), ...(s.blocks ? s.blocks.map(renderBlock) : s.paragraphs.map(p => `<p data-search>${escape(p.text)}${evidenceRefs(p.evidence_ids)}</p>`))]);
    }
    const overview = sections.get("Overview")?.join("") ||
        `<p><strong>${escape(name)}</strong>${handle ? " (" + escape(handle) + ")" : ""} is the subject of this public-source research article. Collected statements remain attributed to their sources; missing biographical details are not inferred.</p>`;
    sections.delete("Overview");
    if (selected.length && !dynamic) {
        const list = `<table class="wikitable project-table"><thead><tr><th>Project</th><th>Source description</th></tr></thead><tbody>${selected
            .map((f) => {
            const url = f.value.match(/https:\/\/[^\s]+$/)?.[0];
            return `<tr data-search><th>${url ? link(url, f.field) : escape(f.field)}</th><td>${escape(f.value.replace(/\s*[—–-]?\s*https:\/\/\S+$/, "").trim() || "Public repository")}${refs(f.source_ids)}</td></tr>`;
        })
            .join("")}</tbody></table>`;
        sections.set("Selected projects", [
            ...(sections.get("Selected projects") || []),
            list,
        ]);
    }
    const profiles = inv.findings.filter((f) => f.category !== "projects" &&
        f.category !== "project" &&
        /profile|website/i.test(f.field) &&
        /^https:\/\/\S+$/.test(f.value));
    if (profiles.length && !dynamic)
        sections.set("Public profiles", [
            ...(sections.get("Public profiles") || []),
            `<table class="wikitable"><thead><tr><th>Public resource</th><th>Profile URL</th></tr></thead><tbody>${[...new Map(profiles.map((f) => [f.value, f])).values()].map((f) => `<tr data-search><th>${escape(f.field)}</th><td>${link(f.value)}${refs(f.source_ids)} <small>${f.identity === "candidate" ? "Candidate match" : "Supplied resource"}</small></td></tr>`).join("")}</tbody></table>`,
        ]);
    if (!sections.has("Identity and verification"))
        sections.set("Identity and verification", [
            `<p>The initial identifiers are research starting points. Matching names and usernames do not by themselves establish common ownership. ${inv.findings.filter((f) => f.status === "conflicting").length ? "Conflicting findings are retained in the evidence view." : ""} <a href="/reports/${inv.id}/evidence/">Review the identity evidence and uncertainty →</a></p>`,
        ]);
    if (inv.timeline.length && !sections.has("Timeline"))
        sections.set("Timeline", [
            `<ul>${inv.timeline.map((t) => `<li data-search><strong>${escape(t.date.start || "Date unknown")}</strong> — ${escape(t.title)}${refs(t.source_ids)} <small>(${escape(t.status)})</small></li>`).join("")}</ul>`,
        ]);
    if (inv.ai?.limitations.length)
        sections.set("Research limitations", [
            ...(sections.get("Research limitations") || []),
            `<details><summary>Source access and research notes</summary><ul>${inv.ai.limitations.map((l) => `<li>${escape(l)}</li>`).join("")}</ul></details>`,
        ]);
    const ordered = dynamic ? [...sections.keys()] : [
        ...titles.filter((t) => sections.has(t)),
        ...[...sections.keys()].filter((t) => !titles.includes(t)),
    ];
    const usedIds = new Set(['content', 'references', 'external-links', 'article-metadata', 'page-information']);
    const sectionIds = new Map<string, string>();
    for (const title of ordered) {
        const base = sectionId(title) || 'section';
        let id = base, index = 2;
        while (usedIds.has(id))
            id = base + '-' + index++;
        usedIds.add(id);
        sectionIds.set(title, id);
    }
    const body = ordered
        .map((t) => `<section id="${sectionIds.get(t)}"><h2>${escape(t)}</h2>${sections.get(t)!.join("")}</section>`)
        .join("");
    const references = referenced
        .map((id, i) => {
        const s = inv.sources.find((s) => s.id === id)!;
        return `<li class="source" id="source-${escape(id)}" value="${i + 1}">${link(s.url, s.url.replace(/^https:\/\//, ""))}. <span class="muted">${escape(s.adapter)}. Retrieved ${escape(dateTime(s.retrieved_at))}.</span><details><summary>Inspect supporting excerpts</summary>${inv.evidence
            .filter((e) => e.source_id === id)
            .map((e) => `<blockquote>${escape(e.excerpt)}</blockquote>`)
            .join("")}</details></li>`;
    })
        .join("");
    const externals = [
        ...new Set([
            ...profiles.map((f) => f.value),
            ...(inv.input.subject.websites || []),
        ]),
    ];
    const toc = `<nav class="contents" aria-label="Contents"><div class="side-title">Contents</div><a href="#content">(Top)</a>${ordered.map((t) => `<a href="#${sectionIds.get(t)}">${escape(t)}</a>`).join("")}<a href="#references">References</a><a href="#external-links">External links</a><a href="#article-metadata">Article metadata</a><p class="muted">Research tools</p><a href="/reports/${inv.id}/evidence/">Evidence ledger</a><a href="/reports/${inv.id}/info/">Dates and API usage</a><a href="/reports/${inv.id}/history/">Profile versions</a></nav>`;
    return page(name, `<div class="page-grid">${toc}<main class="article" id="content"><div class="title-row"><h1>${escape(name)}</h1></div>${articleTabs(inv.id)}<p class="subtitle">From PH0MBER Wiki, the local research encyclopedia</p><p class="article-dateline">Research completed <time datetime="${escape(inv.research_timing?.finished_at || inv.updated_at)}">${escape(dateTime(inv.research_timing?.finished_at || inv.updated_at))}</time> · Last source retrieved ${escape(dateTime(inv.sources
        .filter((s) => s.status === "ok")
        .map((s) => s.retrieved_at)
        .sort()
        .at(-1)))}${version ? " · Version " + version : ""}</p><p class="hatnote">An evidence-cited research draft. Profile-reported claims and candidate account links require review. ${profileURL ? `Part of <a href="${escape(profileURL)}">this profile’s version history</a>.` : ""}</p><div class="report-tools"><input id="report-search" type="search" aria-label="Search within this article" placeholder="Find in this article"><button id="print">Print</button></div>${infobox}<div class="lead biography-lead">${overview}</div>${body}<section id="references"><h2>References</h2><ol class="references">${references || "<li>No external evidence has been collected.</li>"}</ol></section><section id="external-links"><h2>External links</h2>${externals.length ? `<ul class="external-links">${externals.map((u) => `<li>${link(u)}</li>`).join("")}</ul>` : "<p>No independently sourced external profile links were collected.</p>"}</section><div class="categories">Categories: ${escape(inv.input.subject.type || "Person")} profiles · Public-source research · ${escape(inv.status)} coverage</div>${articleMetadata(inv)}<footer class="page-meta" id="page-information">Research started ${escape(dateTime(inv.research_timing?.started_at || inv.created_at))}. Results completed ${escape(dateTime(inv.research_timing?.finished_at))}.<br>Report ${escape(inv.id)}. ${inv.sources.filter((s) => s.status !== "ok").length} unavailable or unsupported sources. <a href="/reports/${inv.id}/info/">Full page information and cost record</a>.</footer></main>${appearance()}</div>`);
}
export function renderEvidence(inv: Investigation): string {
    const refs = (f: Finding) => f.source_ids
        .map((id) => {
        const s = inv.sources.find((s) => s.id === id);
        return s ? link(s.url, s.adapter) : "";
    })
        .join(", ");
    const content = `<h2>Evidence and identity ledger</h2><p>Candidate matches are leads, not confirmed identity links. No local version grouping changes these evidence statuses.</p><input id="report-search" type="search" aria-label="Search within this article" placeholder="Search evidence"><table class="wikitable"><thead><tr><th>Category / field</th><th>Finding</th><th>Assessment</th></tr></thead><tbody>${inv.findings
        .map((f) => `<tr class="finding" id="finding-${escape(f.id)}" data-search><th>${escape(f.category)}<br>${escape(f.field)}</th><td>${escape(f.value)}<br>${refs(f)}${inv.evidence
        .filter((e) => e.finding_id === f.id)
        .map((e) => `<details><summary>Source excerpt · ${escape(dateTime(e.retrieved_at))}</summary><blockquote>${escape(e.excerpt)}</blockquote></details>`)
        .join("")}</td><td><span class="badge ${f.status}">${escape(f.status)}</span><p>${escape(f.confidence.explanation)}</p></td></tr>`)
        .join("")}</tbody></table><h2>Source availability</h2><ul>${inv.sources.map((s) => `<li>${s.url ? link(s.url) : escape(s.adapter)} — ${escape(s.status)}. ${escape(s.detail || "")}</li>`).join("")}</ul><details id="raw-data"><summary>Structured data</summary><pre id="profile-data">${escape(JSON.stringify(inv, null, 2))}</pre></details>`;
    return utility(inv, "Evidence", content);
}
function utility(inv: Investigation, active: string, content: string): string {
    return page(active + " — " + reportTitle(inv), `<div class="page-grid"><nav class="contents"><div class="side-title">Navigation</div><a href="/">Main page</a><a href="/articles/">All articles</a><a href="/reports/${inv.id}/">Read biography</a><a href="/about/">About this wiki</a></nav><main class="article" id="content"><div class="title-row"><h1>${escape(reportTitle(inv))}: ${escape(active)}</h1></div>${articleTabs(inv.id, active)}${content}</main>${appearance()}</div>`);
}
export function renderReportInfo(inv: Investigation): string {
    return utility(inv, "Page information", `${researchMeta(inv)}<h2>Retrieval dates</h2><p>Last successful source retrieval: <strong>${escape(dateTime(inv.sources
        .filter((s) => s.status === "ok")
        .map((s) => s.retrieved_at)
        .sort()
        .at(-1)))}</strong>. Dates in the article are IST; JSON preserves UTC timestamps.</p><h2>Downloads</h2><ul>${["profile", "sources", "evidence", "timeline", "connections", "usage"].map((f) => `<li><a href="/reports/${inv.id}/${f}.json">${f}.json</a></li>`).join("")}</ul><h2>Report metadata</h2><p>ID: <code>${escape(inv.id)}</code> · Format ${escape(inv.schema_version)} · Coverage ${escape(inv.status)}</p><p>Article prose is AI-assisted synthesis; citations identify underlying evidence, not independent verification. Grouping versions changes local organization only.</p>`);
}
export function articleMetadata(inv: Investigation): string {
    const timing = inv.research_timing, u = inv.usage;
    const field = (key: string, value: string) => `<dt>${key}</dt><dd>${escape(value)}</dd>`;
    return `<section class="article-metadata page-meta" id="article-metadata"><h2>Article metadata</h2><dl>${field('Research provider', inv.ai?.provider || (inv.ai?.model?.startsWith('deepseek') ? 'DeepSeek' : inv.ai ? 'Not recorded' : 'Source adapters (no AI)'))}${field('Model', inv.ai?.model || 'Not used')}${field('Research started', dateTime(timing?.started_at || inv.created_at))}${field('Results completed', dateTime(timing?.finished_at))}${field('Elapsed time', timing?.duration_ms === undefined ? 'Not recorded' : (timing.duration_ms / 1000).toFixed(1) + ' seconds (includes pauses)')}${field('Input / output tokens', u ? `${u.totals.prompt_tokens.toLocaleString('en-IN')} / ${u.totals.completion_tokens.toLocaleString('en-IN')}` : 'Not recorded')}${field('API activity', u ? `${u.totals.model_calls} model calls, ${u.totals.search_calls} searches, ${u.totals.fetch_calls} fetches` : 'Not recorded')}${field('Estimated cost (USD)', u?.estimated_usd_min != null ? `$${u.estimated_usd_min.toFixed(6)} to $${u.estimated_usd_max?.toFixed(6)}` : 'Not recorded or pricing unavailable')}${field('Article template', ARTICLE_TEMPLATE.version)}</dl><p>${escape(u?.pricing_note || 'Usage and billing were not recorded for this article. Missing records do not imply zero cost.')} ${u?.pricing_source ? link(u.pricing_source, "Pricing source") + ". " : ""}<a href="/reports/${inv.id}/info/">Full page information</a>.</p></section>`;
}
