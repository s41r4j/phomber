import type { Input } from "./types.js";

export const searchWords = (query: string): string[] =>
  [...new Set(query.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [])];
export const matchesSearch = (text: string, words: string[]): boolean => {
  const normalized = text.normalize("NFKC").toLowerCase();
  return words.every(word => normalized.includes(word));
};
export function subjectSearchText(subject: Input["subject"]): string {
  const strings = (value: unknown): string[] => typeof value === "string" ? [value]
    : Array.isArray(value) ? value.flatMap(strings)
    : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
  return strings(subject).join(" ");
}
