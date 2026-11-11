import https from "node:https";
import { Resolver } from "node:dns/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { publicURL } from "../core/schema.js";
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
export interface HttpResult {
  data: Json;
  retrieved_at: string;
  cached: boolean;
}
export class HttpClient {
  private next = new Map<string, number>();
  constructor(
    private cache: string,
    readonly signal?: AbortSignal,
    private offline = false,
    private ttl = 3600000,
  ) {}
  async get(url: string): Promise<HttpResult> {
    const u = publicURL(url),
      key = createHash("sha256").update(u.href).digest("hex"),
      file = join(this.cache, key + ".json");
    try {
      const c = JSON.parse(await readFile(file, "utf8")) as HttpResult;
      if (Date.now() - Date.parse(c.retrieved_at) < this.ttl)
        return { ...c, cached: true };
    } catch {
      /* cache miss */
    }
    if (this.offline) throw new Error("Offline: no fresh cached response.");
    for (let attempt = 0; attempt < 3; attempt++) {
      this.signal?.throwIfAborted();
      const pause = Math.max(0, (this.next.get(u.origin) || 0) - Date.now());
      if (pause) await this.delay(pause);
      this.next.set(u.origin, Date.now() + 1100);
      try {
        const data = sanitize(await this.request(u, 0)),
          result = {
            data,
            retrieved_at: new Date().toISOString(),
            cached: false,
          };
        await atomicJSON(file, result);
        return result;
      } catch (e) {
        const message = (e as Error).message;
        if (
          attempt === 2 ||
          !/HTTP (429|5\d\d)|timed out|ECONNRESET/.test(message)
        )
          throw e;
        await this.delay(1000 * 2 ** attempt);
      }
    }
    throw new Error("Request failed.");
  }
  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        this.signal?.removeEventListener("abort", abort);
        resolve();
      };
      const timer = setTimeout(done, ms);
      const abort = () => {
        clearTimeout(timer);
        reject(new Error("Cancelled"));
      };
      this.signal?.addEventListener("abort", abort, { once: true });
      if (this.signal?.aborted) abort();
    });
  }
  private async request(u: URL, redirects: number): Promise<Json> {
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
              "PH0MBER-Gen2/4.0 (+https://github.com/s41r4j/phomber)",
            Accept: "application/json",
          },
        },
        (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            try {
              const next = publicURL(new URL(res.headers.location, u).href);
              this.request(next, redirects + 1).then(resolve, reject);
            } catch (e) {
              reject(e);
            }
            return;
          }
          if (status !== 200) {
            res.resume();
            reject(
              new Error(
                `HTTP ${status}; access unavailable, not evidence of absence.`,
              ),
            );
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (b: Buffer) => {
            size += b.length;
            if (size > 2_000_000)
              req.destroy(new Error("Response exceeds 2 MB limit."));
            else chunks.push(b);
          });
          res.on("error", reject);
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
