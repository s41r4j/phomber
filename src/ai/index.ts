import type { Evidence, Finding } from "../core/types.js";
/** Extensions receive only the explicitly selected evidence, never the full workspace. */
export interface AISuggestion {
  text: string;
  evidence_ids: string[];
  kind: "summary" | "disambiguation" | "follow-up";
  verified: false;
}
export interface AIProvider {
  name: string;
  suggest(
    evidence: ReadonlyArray<Evidence>,
    signal?: AbortSignal,
  ): Promise<AISuggestion[]>;
}
export async function assist(
  provider: AIProvider,
  evidence: Evidence[],
  consent: { enabled: boolean; evidence_ids: string[] },
  signal?: AbortSignal,
): Promise<AISuggestion[]> {
  if (!consent.enabled)
    throw new Error(
      "AI is disabled. Explicit configuration and selected evidence IDs are required.",
    );
  const selected = evidence.filter((e) => consent.evidence_ids.includes(e.id));
  if (!selected.length)
    throw new Error("No evidence explicitly selected for AI sharing.");
  const suggestions = await provider.suggest(selected, signal),
    ids = new Set(selected.map((e) => e.id));
  if (
    !suggestions.every(
      (s) =>
        s.verified === false &&
        s.evidence_ids.length > 0 &&
        s.evidence_ids.every((id) => ids.has(id)),
    )
  )
    throw new Error(
      "AI output must cite selected evidence and remain unverified.",
    );
  return suggestions;
}
export type EvidenceBoundFinding = Pick<Finding, "id" | "source_ids">;
