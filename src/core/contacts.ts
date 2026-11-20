import type { Investigation } from "./types.js";
import { researchName, identitySupport } from "./research.js";

export const PUBLIC_CONTACT_INSTRUCTIONS = "Retain explicitly published professional contact email/phone and general city, region or country on a subject-linked first-party profile, portfolio or CV as source-reported information. Use category public-contact and fields public email, public phone or general location. Do not infer, enrich or search private contacts, residential/street addresses, coordinates or leaked data. Do not invent an omission/handling-rules section. Respect investigator omissions. Public availability alone does not prove identity or authorize contact.";

export function publicContactOmitted(omit: readonly string[], field: string): boolean {
  return omit.some(value => /contact/i.test(value) ||
    field === "general location" && value === "location" ||
    field === "public email" && value === "email" ||
    field === "public phone" && value === "phone");
}

export function redactResearchEmails(text: string): string {
  return text.replace(/(?<![\p{L}\p{N}._%+'-])[\p{L}\p{N}._%+'-]+(?:@|%40|&#0*64;|&#x0*40;|&commat;)[\p{L}\p{N}-]+(?:(?:\.|%2e)[\p{L}\p{N}-]+)+/giu, "[email omitted]");
}

export function publicContactAllowed(inv: Investigation, sourceID: string, category: string, field: string, value: string, quote: string): boolean {
  if (category !== "public-contact" || !identitySupport(inv).some(s=>s.source_id===sourceID && s.expand)) return false;
  if (publicContactOmitted(inv.input.research?.omit || [], field)) return false;
  if (/home address|residen|street address|coordinates|password|api.?key|access.?token/i.test(quote)) return false;
  const source = inv.sources.find(s=>s.id===sourceID);
  const name = researchName(inv);
  const cvHeader = !!source && /\.pdf(?:$|[?#])/i.test(source.url) && !!name && quote.includes(name);
  if (field === "public email") return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && (/email|e-mail|mailto:|contact/i.test(quote) || cvHeader);
  if (field === "public phone") return /^\+?[\d ()-]{7,25}$/.test(value) && (/phone|telephone|\btel\b|contact/i.test(quote) || cvHeader);
  if (field === "general location") return value.length <= 100 && !/\d|\bstreet\b|\broad\b|\bavenue\b|\bapartment\b|\bflat\b|\blane\b/i.test(value);
  return false;
}
