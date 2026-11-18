import https from "node:https";
import { setTimeout as sleep } from "node:timers/promises";
import { isIPv4 } from "node:net";
import { Resolver } from "node:dns/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { publicURL } from "../core/schema.js";
import { project } from "../core/project.js";
import { atomicJSON } from "../workspace/index.js";
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export const obj = (v: unknown): Record<string, Json> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, Json>)
    : {};
export const arr = (v: unknown): Json[] =>
  Array.isArray(v) ? (v as Json[]) : [];
export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export function publicIPv4(ip: string): boolean {
  if (!isIPv4(ip)) return false;
  const a = ip.split(".").map(Number);
  if (a.length !== 4 || a.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  const [x, y] = a as [number, number, number, number];
  return !(
    x === 0 ||
    x === 10 ||
    x === 127 ||
    x >= 224 ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && (y === 168 || y === 0)) ||
    (x === 100 && y >= 64 && y <= 127) ||
    (x === 198 && (y === 18 || y === 19))
  );
}
export const pinnedLookup =
  (address: string): NonNullable<https.RequestOptions["lookup"]> =>
  (_host, options, cb) =>
    options.all ? cb(null, [{ address, family: 4 }]) : cb(null, address, 4);
export class SourceError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number, readonly retryAfterMs?: number) {
    super(message); this.name = "SourceError";
  }
}
export function retryAfter(value: string | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(seconds) ? Math.max(0, seconds) : undefined;
}
export interface ResponseMetadata { final_url?: string; next_url?: string; pagination_error?: string }
export interface HttpResult {
  data: Json;
  retrieved_at: string;
  cached: boolean;
  final_url?: string;
  next_url?: string;
  pagination_error?: string;
}
export class HttpClient {
  private next = new Map<string, number>();
  private metadata = new Map<string, ResponseMetadata>();
  private requests = 0;
  constructor(
    private cache: string,
    readonly signal?: AbortSignal,
    private offline = false,
    private ttl = 3600000,
    private options: { maxRequests?: number; maxRetryAfterMs?: number } = {},
  ) {}
  async get(url: string): Promise<HttpResult> {
    this.signal?.throwIfAborted();
    if (this.requests >= (this.options.maxRequests ?? Infinity))
      throw new SourceError("Investigation request budget exhausted.", "budget_exhausted");
    this.requests++;
    const u = publicURL(url),
      key = createHash("sha256").update(u.href).digest("hex"),
      file = join(this.cache, key + ".json");
    try {
      const c: unknown = JSON.parse(await readFile(file, "utf8"));
      const entry = obj(c);
      const age = Date.now() - Date.parse(str(entry.retrieved_at));
      if (Object.hasOwn(entry, "data") && age >= 0 && age < this.ttl) {
        this.signal?.throwIfAborted();
        return { data: sanitize(entry.data!), retrieved_at: str(entry.retrieved_at), cached: true,
          ...(typeof entry.final_url === "string" ? { final_url: publicURL(entry.final_url).href } : {}),
          ...(typeof entry.next_url === "string" ? { next_url: publicURL(entry.next_url).href } : {}),
          ...(typeof entry.pagination_error === "string" ? { pagination_error: entry.pagination_error } : {}),
        };
      }
    } catch {
      /* cache miss */
    }
    this.signal?.throwIfAborted();
    if (this.offline) throw new SourceError("Offline: no fresh cached response.", "offline_cache_miss");
    for (let attempt = 0; attempt < 3; attempt++) {
      this.signal?.throwIfAborted();
      try {
        const data = sanitize(await this.request(u, 0)),
          result = {
            data,
            retrieved_at: new Date().toISOString(),
            cached: false,
            ...this.metadata.get(u.href),
          };
        try {
          await atomicJSON(file, result);
        } catch {
          // Caching is optional; a disk failure must not discard retrieved evidence.
        }
        return result;
      } catch (e) {
        const message = (e as Error).message;
        if (
          attempt === 2 ||
          !(e instanceof SourceError && e.code === "rate_limited") && !/HTTP (429|5\d\d)|timed out|ECONNRESET/.test(message)
        )
          throw e;
        const requested = e instanceof SourceError ? e.retryAfterMs : undefined;
        if (requested !== undefined && requested > (this.options.maxRetryAfterMs ?? 30000)) throw e;
        const backoff = requested ?? 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
        this.next.set(u.origin, Math.max(this.next.get(u.origin) || 0, Date.now() + backoff));
        await this.delay(backoff);
      }
    }
    throw new Error("Request failed.");
  }
  private async delay(ms: number): Promise<void> {
    await sleep(ms, undefined, { signal: this.signal });
  }

  private async request(u: URL, redirects: number, original = u.href): Promise<Json> {
    this.signal?.throwIfAborted();
    if (redirects > 3) throw new Error("Too many redirects.");
    const resolver = new Resolver({ timeout: 4000, tries: 1 });
    const abort = () => resolver.cancel();
    this.signal?.addEventListener("abort", abort, { once: true });
    let address: string;
    try {
      address = (await resolver.resolve4(u.hostname))[0] || "";
    } finally {
      this.signal?.removeEventListener("abort", abort);
    }
    if (!publicIPv4(address)) throw new Error("Blocked nonpublic destination.");
    const pause = Math.max(0, (this.next.get(u.origin) || 0) - Date.now());
    this.next.set(u.origin, Date.now() + pause + 1100);
    if (pause) await this.delay(pause);
    return new Promise<Json>((resolve, reject) => {
      const req = https.request(
        u,
        {
          method: "GET",
          family: 4,
          signal: this.signal,
          lookup: pinnedLookup(address),
          headers: {
            "User-Agent":
              `${project.name}-${project.generation}/${project.version} (+${project.website})`,
            Accept: "application/json",
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            try {
              const next = publicURL(new URL(res.headers.location, u).href);
              this.request(next, redirects + 1, original).then(resolve, reject);
            } catch (e) {
              reject(e);
            }
            return;
          }
          if (status !== 200) {
            res.resume();
            reject(
              new SourceError(
                `HTTP ${status}; access unavailable, not evidence of absence.`,
                status === 429 || (status === 403 && (res.headers["retry-after"] || res.headers["x-ratelimit-remaining"] === "0")) ? "rate_limited" : status === 401 || status === 403 ? "access_denied" : status >= 500 ? "provider_failure" : "http_error",
                status, retryAfter(Array.isArray(res.headers["retry-after"]) ? res.headers["retry-after"][0] : res.headers["retry-after"]) ??
                  (res.headers["x-ratelimit-remaining"] === "0" && Number.isFinite(Number(res.headers["x-ratelimit-reset"])) ? Math.max(0, Number(res.headers["x-ratelimit-reset"]) * 1000 - Date.now()) : undefined),
              ),
            );
            return;
          }
          const linkHeader = res.headers.link;
          const nextLink = typeof linkHeader === "string" ? /<([^>]+)>;\s*rel="?next"?/.exec(linkHeader)?.[1] : undefined;
          let nextURL: string | undefined, paginationError: string | undefined;
          try { if (nextLink) nextURL = publicURL(new URL(nextLink, u).href).href; }
          catch { paginationError = "Provider returned an unsafe pagination URL."; }
          this.metadata.set(original, { final_url: u.href, ...(nextURL ? { next_url: nextURL } : {}), ...(paginationError ? { pagination_error: paginationError } : {}) });
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (b: Buffer) => {
            size += b.length;
            if (size > 2_000_000)
              req.destroy(new Error("Response exceeds 2 MB limit."));
            else chunks.push(b);
          });
          res.on("error", reject);
          res.on("aborted", () => reject(new Error("Source response was interrupted.")));
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()) as Json);
            } catch {
              reject(new Error("Source did not return valid JSON."));
            }
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error("Request timed out.")),
        12000,
      );
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    });
  }
}

/** Cache only the public research fields; never persist RDAP contacts or API credentials. */
export function sanitize(value: Json): Json {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/(?:email|phone|password|secret|token|api.?key|vcard|^entities$|street|postal|address)/i.test(
              key,
            ),
        )
        .map(([key, v]) => [key, sanitize(v)]),
    );
  if (typeof value === "string")
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email omitted]")
      .replace(
        /([?&](?:api_?key|token|secret|password)=)[^&\s]+/gi,
        "$1[redacted]",
      );
  return value;
}
