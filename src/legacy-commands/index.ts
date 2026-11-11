import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { platform, release, arch } from "node:os";
import { join } from "node:path";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { HttpClient, obj, str, arr, publicIPv4 } from "../adapters/http.js";
import { accountTasks, collect } from "../adapters/index.js";
import type { Workspace } from "../workspace/index.js";
export const scanners = [
  "number",
  "ip",
  "mac",
  "whois",
  "dns",
  "username",
  "check",
  "dork",
  "info",
  "exp",
];
export async function scanner(
  command: string,
  target: string,
  workspace: Workspace,
  signal?: AbortSignal,
): Promise<unknown> {
  if (
    !target &&
    ["number", "ip", "mac", "whois", "dns", "username"].includes(command)
  )
    throw new Error(`Usage: phomber ${command} <target>`);
  const http = new HttpClient(join(workspace.root, "cache"), signal);
  if (command === "number") {
    if (!/^\+[1-9]\d{1,14}$/.test(target))
      throw new Error(
        "Use an international phone number, for example +442079460000.",
      );
    const n = parsePhoneNumberFromString(target);
    return {
      number: target,
      valid: n?.isValid() || false,
      possible: n?.isPossible() || false,
      country: n?.country || null,
      calling_code: n?.countryCallingCode || null,
      type: n?.getType() || null,
      source: "Bundled libphonenumber metadata",
      limitation:
        "Number format and numbering-plan metadata only; no subscriber, live location, carrier identity or ownership lookup.",
    };
  }
  if (command === "dns") {
    if (!isIP(target) && !/^([a-z\d-]+\.)+[a-z]{2,63}$/i.test(target))
      throw new Error("Provide a domain or IP address.");
    const resolver = new Resolver({ timeout: 3000, tries: 1 });
    const abort = () => resolver.cancel();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (isIP(target)) return { target, PTR: await resolver.reverse(target) };
      const results = await Promise.allSettled(
        ["A", "AAAA", "MX", "NS", "TXT", "SOA"].map((type) =>
          resolver.resolve(target, type),
        ),
      );
      return {
        target,
        records: Object.fromEntries(
          results.map((r, i) => [
            ["A", "AAAA", "MX", "NS", "TXT", "SOA"][i],
            r.status === "fulfilled" ? r.value : { unavailable: true },
          ]),
        ),
      };
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }
  if (command === "whois" || command === "ip") {
    if (
      command === "ip" &&
      (!isIP(target) ||
        (isIP(target) === 4 && !publicIPv4(target)) ||
        isIP(target) === 6)
    )
      throw new Error(
        "IP registration lookup currently supports public IPv4 addresses.",
      );
    if (command === "whois" && !/^([a-z\d-]+\.)+[a-z]{2,63}$/i.test(target))
      throw new Error("Provide a public domain.");
    const url = `https://rdap.org/${command === "ip" ? "ip" : "domain"}/${encodeURIComponent(target)}`,
      r = await http.get(url),
      d = obj(r.data);
    return {
      target,
      source: url,
      retrieved_at: r.retrieved_at,
      name: d.name || d.ldhName,
      country: d.country,
      status: d.status,
      nameservers: arr(d.nameservers).map((n) => str(obj(n).ldhName)),
      events: d.events,
      limitation:
        "RDAP replaces legacy WHOIS; contact entities and precise addresses are intentionally omitted.",
    };
  }
  if (command === "mac") {
    const mac = target.replace(/[-:]/g, "").toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(mac))
      throw new Error("Use a 48-bit MAC address.");
    const local = !!(parseInt(mac.slice(0, 2), 16) & 2),
      multicast = !!(parseInt(mac.slice(0, 2), 16) & 1);
    if (local || multicast)
      return {
        mac,
        locally_administered: local,
        multicast,
        limitation: "A vendor cannot be reliably inferred from this address.",
      };
    const url = `https://api.maclookup.app/v2/macs/${mac}`,
      r = await http.get(url),
      d = obj(r.data);
    return {
      mac,
      vendor: d.company || null,
      found: d.found || false,
      source: url,
      retrieved_at: r.retrieved_at,
    };
  }
  if (command === "username") {
    const results = [];
    for (const platform of ["github", "gitlab", "dev", "huggingface"])
      for (const task of accountTasks(
        { platform, username: target },
        "quick",
        "candidate",
      )) {
        try {
          const r = await collect(task, http);
          results.push({
            platform,
            url: task.url,
            status: "lead",
            records: r.records,
            retrieved_at: r.retrieved_at,
          });
        } catch (e) {
          results.push({
            platform,
            status: "unavailable",
            detail: (e as Error).message,
          });
        }
      }
    if (!/^[\w.-]{1,100}$/.test(target)) throw new Error("Invalid username.");
    return {
      username: target,
      warning:
        "Matching handles do not prove common ownership; failed lookups do not prove absence.",
      results,
    };
  }
  if (command === "check") {
    try {
      await http.get("https://api.github.com/rate_limit");
      return { reachable: true };
    } catch {
      try {
        await http.get("https://dns.google/resolve?name=example.com&type=A");
        return { reachable: true, source: "Google public DNS" };
      } catch (e) {
        return { reachable: false, detail: (e as Error).message };
      }
    }
  }
  if (command === "dork") {
    const queries = [
      'site:github.com "YOUR SUBJECT"',
      'site:orcid.org "YOUR SUBJECT"',
      'site:edu "YOUR SUBJECT" publication',
      '"YOUR SUBJECT" portfolio',
    ];
    return {
      query: queries[Math.floor(Math.random() * queries.length)],
      note: "Public research search template; substitute a subject and review results manually.",
    };
  }
  if (command === "info")
    return {
      name: "PH0MBER Gen2",
      version: "4.0.0-gen2.0",
      runtime: process.version,
      platform: platform(),
      release: release(),
      architecture: arch(),
      workspace: workspace.root,
    };
  if (command === "exp")
    return {
      ":D": "success",
      ":)": "information",
      ":|": "warning",
      ":(": "error",
      ":o": "results available",
    };
  throw new Error("Unknown scanner.");
}
