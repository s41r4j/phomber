# PH0MBER article contract 1.0

All research providers use the same article contract. Current integration: DeepSeek. No second provider is enabled by this change.

The application supplies the page title, a dynamic source-attributed infobox, numbered References, external links and article metadata. Those sections cannot be overridden by AI output. Infobox fields such as education, career, certifications and profile image appear when supported by the collected data. Missing fields are omitted.

The AI supplies sections in narrative order, with arbitrary useful titles and ordered blocks. Small reports may have only a summary and a few sections. Larger reports can interleave tables, lists, quotations and subheadings between paragraphs. Table and list sizes are bounded for practical rendering.

```json
{
  "sections": [
    {
      "title": "Career and technical work",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A candidate profile describes research work.",
          "evidence_ids": ["E1"]
        },
        {
          "type": "table",
          "caption": "Selected public work",
          "columns": ["Project", "Description"],
          "rows": [
            {"cells": ["Example", "Public research tool"], "evidence_ids": ["E2"]}
          ]
        },
        {"type": "subheading", "title": "Writing"},
        {
          "type": "list",
          "ordered": false,
          "items": [{"text": "An attributed publication.", "evidence_ids": ["E3"]}]
        }
      ]
    }
  ]
}
```

A quotation uses `{"type":"quote","text":"exact source excerpt","evidence_ids":["E1"]}`. The validator checks that it occurs in at least one cited evidence excerpt. Paragraphs, quotes, list items and table rows require real evidence IDs. Headers and captions should label content rather than introduce unsupported factual claims. Short provider IDs such as E1 are mapped to stored evidence IDs before validation. Source IDs or URLs cannot substitute for evidence IDs.

The exported `ARTICLE_INSTRUCTIONS` and `validateArticleSections` in `src/core/article.ts` are shared with future adapters. `schemas/article.schema.json` defines the JSON shape. Validation enforces citations, rectangular tables, source-exact quotations and size limits. The investigation schema also validates stored blocks. HTML is always escaped. Older `paragraphs` arrays remain supported and can be rendered without another paid research request.

Metadata comes from recorded execution, not AI prose: provider/model, research start and completion, elapsed duration including pauses, input/output tokens, model/search/fetch calls and estimated USD interval. Provider-specific billing logic must populate the usage ledger. Unknown models or unavailable billing data must not be represented as zero cost. Preserve UTC machine timestamps and display IST labels consistently.

Use no em dashes in newly generated prose. Rendering also normalizes historical em dashes for display without altering original source records. New provider adapters must preserve candidate identity labels, exact citations and attribution of self-reported claims.
