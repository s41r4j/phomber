import type { Investigation } from './types.js';
export interface CitedText {
    text: string;
    evidence_ids: string[];
}
export type ArticleBlock = ({
    type: 'paragraph';
} & CitedText) | ({
    type: 'quote';
} & CitedText) | {
    type: 'subheading';
    title: string;
} | {
    type: 'list';
    ordered?: boolean;
    items: CitedText[];
} | {
    type: 'table';
    caption?: string;
    columns: string[];
    rows: {
        cells: string[];
        evidence_ids: string[];
    }[];
};
export interface ArticleSection {
    title: string;
    paragraphs: CitedText[];
    blocks?: ArticleBlock[];
}
export interface AIResearch {
    provider?: string;
    model: string;
    status: 'complete' | 'partial';
    sections: ArticleSection[];
    limitations: string[];
}
export const ARTICLE_INSTRUCTIONS = `Use the PH0MBER article template. Return JSON with a sections array. Each section has a title and ordered blocks. Supported blocks are paragraph or quote {type,text,evidence_ids}, subheading {type,title}, list {type,ordered,items:[{text,evidence_ids}]}, and table {type,caption,columns:[string],rows:[{cells:[string],evidence_ids}]}. Every factual paragraph, quote, list item and table row requires evidence IDs. Table rows must match the number of columns. Quotations must exactly match cited evidence. Use at most 30 sections, 100 blocks per section, 12 table columns and 100 table rows or list items. Use informative section titles and interleave text, tables and lists where helpful. The renderer supplies the title, infobox, References, External links and Article metadata. Do not generate those reserved sections or raw HTML. Do not use em dashes (U+2014). Omit unsupported topics rather than generating empty sections explaining there is no information. Missing facts must be omitted rather than invented. Example: {"sections":[{"title":"Overview","blocks":[{"type":"paragraph","text":"A cited summary.","evidence_ids":["E1"]}]}]}`;
export const ARTICLE_TEMPLATE = { version: '1.0', required: ['title', 'infobox', 'references', 'metadata'], optional_blocks: ['paragraph', 'table', 'list', 'subheading', 'quote'], max_sections: 30 } as const;
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown, max = 6000): string => { if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new Error('Article text is missing or exceeds its limit.'); return v; };
export function validateArticleSections(value: unknown, inv: Investigation): ArticleSection[] {
    const allowed = new Set(inv.evidence.map(e => e.id));
    const citations = (v: unknown): string[] => { const ids = array(v); if (!ids.length || ids.length > 200 || ids.some(id => typeof id !== 'string' || !allowed.has(id)))
        throw new Error('AI narrative contains unsupported evidence citations.'); return [...new Set(ids as string[])]; };
    const cited = (v: unknown): CitedText => { const p = record(v); return { text: text(p.text), evidence_ids: citations(p.evidence_ids) }; };
    const sections = array(record(value).sections);
    if (sections.length > 30)
        throw new Error('Too many article sections.');
    const seenTitles = new Set<string>();
    return sections.map(raw => {
        const section = record(raw), title = text(section.title, 200);
        const key = title.trim().toLowerCase();
        if (seenTitles.has(key))
            throw new Error('Duplicate article section title.');
        seenTitles.add(key);
        if (/^(references|external links|article metadata)$/i.test(title.trim()))
            throw new Error("This section is provided by the article template.");
        if (section.blocks !== undefined) {
            const rawBlocks = array(section.blocks);
            if (!Array.isArray(section.blocks) || !rawBlocks.length || rawBlocks.length > 100)
                throw new Error('Invalid article blocks.');
            const blocks: ArticleBlock[] = rawBlocks.map(rawBlock => {
                const b = record(rawBlock);
                if (b.type === 'paragraph' || b.type === 'quote') {
                    const p = cited(b);
                    if (b.type === 'quote' && !p.evidence_ids.some(id => inv.evidence.find(e => e.id === id)?.excerpt.includes(p.text)))
                        throw new Error('A quotation must match cited evidence exactly.');
                    return { type: b.type, ...p };
                }
                if (b.type === 'subheading')
                    return { type: 'subheading', title: text(b.title, 200) };
                if (b.type === 'list') {
                    const items = array(b.items);
                    if (!items.length || items.length > 100)
                        throw new Error('Invalid list size.');
                    return { type: 'list', ordered: b.ordered === true, items: items.map(cited) };
                }
                if (b.type === 'table') {
                    const columns = array(b.columns).map(c => text(c, 200)), rows = array(b.rows);
                    if (!columns.length || columns.length > 12 || !rows.length || rows.length > 100)
                        throw new Error('Invalid table size.');
                    return { type: 'table', ...(b.caption ? { caption: text(b.caption, 500) } : {}), columns, rows: rows.map(rawRow => { const r = record(rawRow), cells = array(r.cells).map(c => text(c, 4000)); if (cells.length !== columns.length)
                            throw new Error('Table row width does not match its columns.'); return { cells, evidence_ids: citations(r.evidence_ids) }; }) };
                }
                throw new Error('Unsupported article block. Raw HTML is not permitted.');
            });
            return { title, blocks, paragraphs: blocks.flatMap(b => b.type === 'paragraph' || b.type === 'quote' ? [{ text: b.text, evidence_ids: b.evidence_ids }] : []) };
        }
        const paragraphs = array(section.paragraphs);
        if (paragraphs.length > 100)
            throw new Error('Too many paragraphs.');
        return { title, paragraphs: paragraphs.map(cited) };
    }).filter(s => s.paragraphs.length || s.blocks?.length);
}
export function articleText(sections: ArticleSection[]): string { return sections.flatMap(s => [s.title, ...(s.blocks ? s.blocks.flatMap(b => b.type === 'paragraph' || b.type === 'quote' ? [b.text] : b.type === 'subheading' ? [b.title] : b.type === 'list' ? b.items.map(i => i.text) : [b.caption || '', ...b.columns, ...b.rows.flatMap(r => r.cells)]) : s.paragraphs.map(p => p.text))]).join(' '); }
/** Adapt provider short citation labels to stored evidence IDs before validation. */
export function mapArticleCitations(value: unknown, inv: Investigation): void {
    if (Array.isArray(value)) {
        value.forEach(v => mapArticleCitations(v, inv));
        return;
    }
    if (!value || typeof value !== 'object')
        return;
    for (const [key, v] of Object.entries(value)) {
        if (key === 'evidence_ids' && Array.isArray(v))
            (value as Record<string, unknown>)[key] = v.map(raw => { const m = typeof raw === 'string' ? /^E([1-9]\d*)$/.exec(raw) : null; return m ? inv.evidence[Number(m[1]) - 1]?.id || raw : raw; });
        else
            mapArticleCitations(v, inv);
    }
}
