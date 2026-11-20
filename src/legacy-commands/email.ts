import { Resolver } from "node:dns/promises";
import { domainToASCII } from "node:url";
import { parse as parseDomain } from "tldts";

export const emailNotice = "Check only your own email or an address whose owner has authorized the check. Public availability does not grant permission to contact or republish personal data.";
export async function checkEmail(target: string, signal?: AbortSignal, resolver = new Resolver({ timeout: 3000, tries: 1 })) {
  signal?.throwIfAborted();
  const value = target.trim(), at = value.lastIndexOf("@");
  const local = value.slice(0, at), domain = domainToASCII(value.slice(at + 1).replace(/\.$/, "").toLowerCase());
  const valid = at > 0 && value.length <= 254 && local.length <= 64 && /^[a-z0-9!#$%&'*+\-/=?^_`{|}~.]+$/i.test(local) &&
    !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") && domain.length <= 253 &&
    domain.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) && domain.includes(".");
  const result = { email: valid ? local.slice(0,1) + "***@" + domain : "[invalid input]", domain: valid ? domain : null,
    syntax: valid ? "supported" : "invalid-or-unsupported", mail_domain: "not-checked", mx: [] as { exchange: string; priority: number }[],
    mailbox_exists: "unknown", owner_identity: "unverified", breach_status: "not-checked", notice: emailNotice,
    limitation: "Common ASCII mailbox syntax and public DNS only. No SMTP probes, test messages, mailbox-existence claim, personal-data search or breach lookup. Quoted or internationalized local parts are not supported." };
  if (!valid) return result;
  if (!parseDomain(domain).isIcann) { result.mail_domain = "non-public-or-unknown-suffix"; return result; }
  const abort = () => resolver.cancel(); signal?.addEventListener("abort", abort, { once: true });
  try {
    try {
      const mx = await resolver.resolveMx(domain); signal?.throwIfAborted();
      if (mx.some(record => record.priority === 0 && (!record.exchange || record.exchange === "."))) {
        result.mail_domain = "explicitly-does-not-accept-mail"; return result;
      }
      result.mx = mx.sort((a,b) => a.priority - b.priority);
      if (mx.length) { result.mail_domain = "mx-records-present"; return result; }
    } catch (error) {
      signal?.throwIfAborted();
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOTFOUND" || code === "ENONAME") { result.mail_domain = "domain-not-found"; return result; }
      if (code !== "ENODATA") { result.mail_domain = "dns-unavailable"; return result; }
    }
    const addresses = await Promise.allSettled([resolver.resolve4(domain), resolver.resolve6(domain)]);
    signal?.throwIfAborted();
    result.mail_domain = addresses.some(r => r.status === "fulfilled" && r.value.length) ? "implicit-mx-address-records-present" :
      addresses.some(r => r.status === "rejected" && !["ENODATA","ENOTFOUND","ENONAME"].includes(r.reason?.code)) ? "dns-unavailable" : "no-mail-routing-records";
    return result;
  } finally { signal?.removeEventListener("abort", abort); }
}
