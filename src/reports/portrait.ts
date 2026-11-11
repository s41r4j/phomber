import https from "node:https";
import { Resolver } from "node:dns/promises";
import { join } from "node:path";
import {
  HttpClient,
  obj,
  str,
  publicIPv4,
  pinnedLookup,
} from "../adapters/http.js";
import type { Investigation } from "../core/types.js";
import type { Workspace } from "../workspace/index.js";
/** Downloads only an image returned by an already-cited GitHub profile API. No inferred image URLs. */
export async function enrichPortrait(
  inv: Investigation,
  workspace: Workspace,
): Promise<boolean> {
  if (inv.portrait) return false;
  const source = inv.sources.find(
    (s) =>
      s.status === "ok" &&
      s.adapter === "github" &&
      /^https:\/\/api\.github\.com\/users\/[a-z\d-]+$/i.test(s.url),
  );
  if (!source) return false;
  const response = await new HttpClient(join(workspace.root, "cache")).get(
      source.url,
    ),
    url = str(obj(response.data).avatar_url);
  if (!url) return false;
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "avatars.githubusercontent.com" ||
    u.username ||
    u.password ||
    u.port
  )
    return false;
  u.searchParams.set("s", "320");
  const resolver = new Resolver({ timeout: 4000, tries: 1 }),
    address = (await resolver.resolve4(u.hostname))[0];
  if (!address || !publicIPv4(address))
    throw new Error("Portrait host resolved to a nonpublic address.");
  const result = await new Promise<{ bytes: Buffer; mime: string }>(
    (resolve, reject) => {
      const req = https.get(
        u,
        {
          family: 4,
          lookup: pinnedLookup(address),
          headers: { "User-Agent": "PH0MBER/4.0" },
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error("Portrait unavailable"));
            return;
          }
          const parts: Buffer[] = [];
          let size = 0;
          res.on("data", (b: Buffer) => {
            size += b.length;
            if (size > 1_000_000)
              req.destroy(new Error("Portrait exceeds size limit"));
            else parts.push(b);
          });
          res.on("error", reject);
          res.on("end", () => {
            const bytes = Buffer.concat(parts);
            const mime = bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              ? "image/png"
              : bytes[0] === 255 && bytes[1] === 216
                ? "image/jpeg"
                : bytes.subarray(0, 6).toString().startsWith("GIF8")
                  ? "image/gif"
                  : bytes.subarray(0, 4).toString() === "RIFF" &&
                      bytes.subarray(8, 12).toString() === "WEBP"
                    ? "image/webp"
                    : "";
            if (!mime) {
              reject(new Error("Portrait is not a supported raster image"));
              return;
            }
            resolve({ bytes, mime });
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error("Portrait timeout")),
        12000,
      );
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
    },
  );
  inv.portrait = {
    data_url:
      "data:" + result.mime + ";base64," + result.bytes.toString("base64"),
    source_id: source.id,
    original_url: url,
    retrieved_at: new Date().toISOString(),
    caption:
      "Portrait displayed by the candidate public profile; account ownership is not independently established.",
  };
  return true;
}
