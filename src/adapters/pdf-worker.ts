import { parentPort, workerData } from "node:worker_threads";
import { extractLinks, extractText, getDocumentProxy } from "unpdf";

// Parsing stays off the main event loop so a malformed document can be terminated.
globalThis.fetch = async () => { throw new Error("Network requests are disabled inside PDF extraction."); };
// PDF.js uses Promise.try; keep the Node 22 compatibility shim inside this worker.
if (!("try" in Promise)) Object.defineProperty(Promise, "try", {
  configurable: true, writable: true,
  value: (callback: (...args: unknown[]) => unknown, ...args: unknown[]) => new Promise(resolve => resolve(callback(...args))),
});
try {
  const pdf = await getDocumentProxy(new Uint8Array(workerData), {
    isEvalSupported: false, useSystemFonts: false, useWorkerFetch: false,
    disableFontFace: true, maxImageSize: 1_000_000, verbosity: 0,
  });
  try {
    if (pdf.numPages > 25) throw new Error("PDF exceeds the 25-page extraction limit.");
    const result = await extractText(pdf, { mergePages: true });
    if (!result.text.trim()) throw new Error("PDF has no extractable text; scanned documents require OCR.");
    if (result.text.length > 120_000) throw new Error("PDF text exceeds the 120,000-character extraction limit.");
    const links = await extractLinks(pdf);
    parentPort?.postMessage({ content: result.text, pages: pdf.numPages, links: links.links.flat().filter(url => url.length <= 2048).slice(0, 100) });
  } finally { await pdf.destroy(); }
} catch (error) {
  parentPort?.postMessage({ error: (error as Error).message.slice(0, 500) });
}
