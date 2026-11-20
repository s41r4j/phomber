import https from "node:https";
import { Resolver } from "node:dns/promises";
import { Worker } from "node:worker_threads";
import { publicURL } from "../core/schema.js";
import { obj, str, sanitize, publicIPv4, pinnedLookup } from "./http.js";
import { project } from "../core/project.js";
import type { Depth } from "../core/types.js";

export const sanitizeResearchText = (text: string): string => text.replace(/([?&](?:api_?key|token|secret|password)=)[^&\s]+/gi,"$1[redacted]").replace(
  /^(?:home address|residential address|street address|address|date of birth|dob|passport|aadhaar|aadhar|ssn|national id|password|secret|api[_ ]?key|access[_ ]?token)\s*:[^\n]*/gim,"[private identifier omitted]");
export const sanitizeDocumentText = (text: string, publicContacts = false): string => publicContacts ? sanitizeResearchText(text) : str(sanitize(text)).replace(
  /^(?:e[- ]?mail|phone|mobile|telephone|tel|home address|residential address|street address|address|date of birth|dob|passport|aadhaar|aadhar|ssn|national id)\s*:[^\n]*/gim,
  "[personal contact or identifier line omitted]",
);
export const isPDFResource = (value: string): boolean => {
  try { const u = publicURL(value); return /\.pdf$/i.test(u.pathname) || /(?:^|\/)(?:cv|resume)(?:\/|$)/i.test(u.pathname) || u.searchParams.get("format")?.toLowerCase() === "pdf"; }
  catch { return false; }
};
export interface DocumentText { content: string; pages: number; links: string[] }
export async function extractPDF(bytes: Uint8Array, signal?: AbortSignal, timeoutMs = 15000, publicContacts = false): Promise<DocumentText> {
  signal?.throwIfAborted();
  if (bytes.byteLength > 8_000_000) throw new Error("PDF exceeds the 8 MB extraction limit.");
  if (Buffer.from(bytes.subarray(0, 1024)).indexOf("%PDF-") < 0) throw new Error("Resource is not a PDF document.");
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdf-worker.js", import.meta.url), { workerData: bytes, execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 }, stdout: true, stderr: true });
    worker.stdout?.resume(); worker.stderr?.resume();
    let finished = false;
    const finish = (error?: Error, result?: DocumentText) => {
      if (finished) return; finished = true;
      clearTimeout(timer); signal?.removeEventListener("abort", abort);
      const settle = () => error ? reject(error) : resolve(result!);
      void worker.terminate().then(settle, settle);
    };
    const abort = () => finish(signal?.reason instanceof Error ? signal.reason : new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("PDF extraction timed out.")), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.once("error", error => finish(error));
    worker.once("exit", () => { if (!finished) finish(new Error("PDF extraction ended without usable text.")); });
    worker.once("message", raw => {
      const data = obj(raw);
      if (data.error) { finish(new Error(str(data.error))); return; }
      if (typeof data.content !== "string" || !Number.isInteger(data.pages) || Number(data.pages) < 1) { finish(new Error("Invalid PDF extraction result.")); return; }
      const links = Array.isArray(data.links) ? data.links.map(str).filter(url => { try { publicURL(url); return sanitize(url) === url; } catch { return false; } }) : [];
      finish(undefined, { content: sanitizeDocumentText(data.content,publicContacts), pages: Number(data.pages), links });
    });
  });
}
export async function downloadPublicPDF(value: string, signal?: AbortSignal): Promise<Uint8Array> {
  const combined = AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])]);
  const read = async (url: URL, redirects = 0): Promise<Uint8Array> => {
    combined.throwIfAborted();
    if (redirects > 3) throw new Error("Too many PDF redirects.");
    const resolver = new Resolver({ timeout: 4000, tries: 1 });
    const cancel = () => resolver.cancel(); combined.addEventListener("abort", cancel, { once: true });
    let address: string;
    try { address = (await resolver.resolve4(url.hostname))[0] || ""; }
    finally { combined.removeEventListener("abort", cancel); }
    combined.throwIfAborted();
    if (!publicIPv4(address)) throw new Error("Blocked nonpublic PDF destination.");
    return new Promise((resolve, reject) => {
      const req = https.get(url, { signal: combined, family: 4, lookup: pinnedLookup(address),
        headers: { Accept: "application/pdf", "User-Agent": `${project.name}/${project.version}` } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); try { read(publicURL(new URL(res.headers.location, url).href), redirects + 1).then(resolve, reject); } catch (error) { reject(error); } return;
        }
        if (res.statusCode !== 200) { res.resume(); reject(new Error("PDF retrieval HTTP " + res.statusCode)); return; }
        let size = 0; const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 8_000_000) req.destroy(new Error("PDF exceeds the 8 MB download limit.")); else chunks.push(chunk); });
        res.on("error", reject); res.on("aborted", () => reject(new Error("PDF download interrupted.")));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      });
      req.on("error", reject);
    });
  };
  return read(publicURL(value));
}
export function documentReader(depth: Depth, signal?: AbortSignal) {
  let used = 0; const limit = depth === "quick" ? 1 : depth === "deep" ? 4 : 2;
  return async (url: string): Promise<DocumentText> => {
    if (++used > limit) throw new Error("Local PDF document budget exhausted.");
    return extractPDF(await downloadPublicPDF(url, signal), signal,15000,true);
  };
}
