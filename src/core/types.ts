export type Depth = "quick" | "standard" | "deep";
export type Status =
  | "user-provided"
  | "verified"
  | "corroborated"
  | "lead"
  | "conflicting"
  | "unavailable";
export interface DateValue {
  start?: string;
  end?: string;
  precision?: "day" | "month" | "year" | "unknown";
  uncertain?: boolean;
}
export interface RecordEntry {
  [key: string]: unknown;
  name?: string;
  title?: string;
  date?: DateValue;
  sources?: string[];
}
export interface Social {
  platform: string;
  username?: string;
  url?: string;
}
export interface Subject {
  type?: string;
  name?: string;
  first_name?: string;
  middle_name?: string;
  surname?: string;
  preferred_name?: string;
  aliases?: string[];
  usernames?: string[];
  biography?: string;
  languages?: string[];
  nationality?: string;
  location?: string;
  education?: RecordEntry[];
  professional?: {
    company?: string;
    companies?: string[];
    history?: RecordEntry[];
    [key: string]: unknown;
  };
  socials?: Social[];
  websites?: string[];
  domains?: string[];
  projects?: RecordEntry[];
  connections?: RecordEntry[];
  achievements?: RecordEntry[];
  publications?: RecordEntry[];
  organizations?: RecordEntry[];
  community?: RecordEntry[];
  timeline?: RecordEntry[];
  digital_footprint?: RecordEntry[];
  custom?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
export interface Input {
  schema_version: "1.0";
  subject: Subject;
  research?: { depth?: Depth; offline?: boolean; omit?: string[] };
  output?: ("html" | "json")[];
  evidence?: ImportedEvidence[];
}
export interface ImportedEvidence {
  category: string;
  field: string;
  value: string;
  url: string;
  excerpt: string;
  retrieved_at: string;
}
export interface Finding {
  id: string;
  category: string;
  field: string;
  value: string;
  status: Status;
  source_ids: string[];
  confidence: { score: number | null; explanation: string };
  identity: "provided" | "candidate" | "anchored";
}
export interface Source {
  id: string;
  adapter: string;
  url: string;
  retrieved_at: string;
  status: "ok" | "unavailable" | "unsupported";
  detail?: string;
  cached?: boolean;
}
export interface Evidence {
  id: string;
  finding_id: string;
  source_id: string;
  excerpt: string;
  retrieved_at: string;
}
export interface TimelineEntry {
  title: string;
  date: DateValue;
  source_ids: string[];
  status: Status;
}
export interface Connection {
  name: string;
  relationship: string;
  source_ids: string[];
  status: Status;
}
export interface Investigation {
  portrait?: {
    data_url: string;
    source_id: string;
    original_url: string;
    retrieved_at: string;
    caption: string;
  };
  research_timing?: {
    started_at: string;
    finished_at?: string;
    duration_ms?: number;
  };
  usage?: import("../ai/usage.js").ResearchUsage;
  ai?: import("./article.js").AIResearch;
  schema_version: "1.0";
  id: string;
  created_at: string;
  updated_at: string;
  status: "running" | "complete" | "partial" | "interrupted";
  input: Input;
  findings: Finding[];
  sources: Source[];
  evidence: Evidence[];
  connections: Connection[];
  timeline: TimelineEntry[];
  plan: string[];
  warnings: string[];
  summary: string;
  depth: Depth;
}
export interface IndexEntry {
  research_started_at?: string;
  research_finished_at?: string;
  duration_ms?: number;
  search_text?: string;
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
  status: Investigation["status"];
  source_count: number;
  verified_count: number;
  depth: Depth;
  formats: string[];
}
export interface Candidate {
  category: string;
  field: string;
  value: string;
  excerpt?: string;
  identity?: "candidate" | "anchored";
  date?: DateValue;
  relationship?: string;
}
export interface Collection {
  url: string;
  records: Candidate[];
  detail?: string;
}
