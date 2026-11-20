import { SourceError, HttpClient, obj, arr, str, type Json } from "./http.js";
import type { Candidate, Depth, Input, Social } from "../core/types.js";
import { publicURL } from "../core/schema.js";
import { matchingAuthors } from "../core/publications.js";
export interface Task {
  adapter: string;
  url: string;
  identity: "candidate" | "anchored";
  parse: (data: Json) => Candidate[];
}
export const platforms = [
  "linkedin",
  "github",
  "gitlab",
  "bitbucket",
  "x",
  "instagram",
  "facebook",
  "threads",
  "bluesky",
  "mastodon",
  "reddit",
  "youtube",
  "twitch",
  "medium",
  "dev",
  "hashnode",
  "stackoverflow",
  "stackexchange",
  "quora",
  "behance",
  "dribbble",
  "kaggle",
  "huggingface",
  "researchgate",
  "scholar",
  "orcid",
  "producthunt",
  "indiehackers",
  "npm",
  "pypi",
  "dockerhub",
];
const API_PLATFORMS = new Set(["github", "gitlab", "dev", "huggingface"]);
export function normalizeSocial(value: string): Social {
  if (value.startsWith("https://")) {
    const u = publicURL(value),
      hosts: Record<string, string> = {
        "github.com": "github",
        "gitlab.com": "gitlab",
        "dev.to": "dev",
        "huggingface.co": "huggingface",
        "www.linkedin.com": "linkedin",
        "linkedin.com": "linkedin",
        "x.com": "x",
        "instagram.com": "instagram",
        "www.instagram.com": "instagram",
        "bsky.app": "bluesky",
        "www.youtube.com": "youtube",
      };
    const platform = hosts[u.hostname] || u.hostname;
    const parts = u.pathname.split("/").filter(Boolean);
    if (API_PLATFORMS.has(platform) && parts.length !== 1)
      throw new Error("Supply an account profile URL, not a repository or content URL.");
    if (platform === "github" && /^(settings|login|signup|search|explore|marketplace|orgs|users|topics|collections|features|about|pricing|contact|security|sponsors|notifications|new|organizations)$/i.test(parts[0] || ""))
      throw new Error("Supply a GitHub account profile URL.");
    return {
      platform,
      url: u.href,
      username: u.pathname
        .split("/")
        .filter(Boolean)
        .at(["bluesky", "linkedin"].includes(platform) ? 1 : 0)
        ?.replace(/^@/, ""),
    };
  }
  const i = value.indexOf(":");
  if (i < 1)
    throw new Error(
      "Social profiles use platform:username or a public HTTPS URL.",
    );
  return {
    platform: value.slice(0, i).toLowerCase(),
    username: value.slice(i + 1).replace(/^@/, ""),
  };
}
const fields = (
  data: Json,
  map: Record<string, [string, string]>,
): Candidate[] =>
  Object.entries(map).flatMap(([key, [category, field]]) => {
    const v = obj(data)[key];
    return typeof v === "string" && v.trim()
      ? [{ category, field, value: v }]
      : [];
  });
export function accountTasks(
  social: Social,
  depth: Depth,
  identity: "candidate" | "anchored",
): Task[] {
  const user = social.username;
  if (!user || !/^[\w.-]{1,100}$/.test(user)) return [];
  const encoded = encodeURIComponent(user),
    tasks: Task[] = [];
  if (social.platform === "github") {
    tasks.push({
      adapter: "github",
      url: `https://api.github.com/users/${encoded}`,
      identity,
      parse: (d) =>
        fields(d, {
          login: ["online", "github username"],
          name: ["identity", "name"],
          bio: ["identity", "biography"],
          company: ["professional", "company"],
          blog: ["online", "website"],
          html_url: ["online", "github profile"],
          avatar_url: ["online", "profile image"],
          created_at: ["timeline", "GitHub account created"],
        }),
    });
    if (depth !== "quick")
      tasks.push({
        adapter: "github-projects",
        url: `https://api.github.com/users/${encoded}/repos?sort=updated&per_page=${depth === "deep" ? 30 : 10}`,
        identity,
        parse: (d) =>
          arr(d)
            .filter((r) => !obj(r).fork)
            .map((r) => ({
              category: "projects",
              field: str(obj(r).name),
              value: [str(obj(r).description), str(obj(r).html_url)]
                .filter(Boolean)
                .join(" - "),
              date: {
                start: str(obj(r).created_at).slice(0, 10),
                precision: "day",
              },
            })),
      });
    if (depth === "deep")
      tasks.push({
        adapter: "github-organizations",
        url: `https://api.github.com/users/${encoded}/orgs?per_page=20`,
        identity,
        parse: (d) =>
          arr(d).map((r) => ({
            category: "connections",
            field: str(obj(r).login),
            value: "Public organization membership",
            relationship: "public organization membership",
          })),
      });
  } else if (social.platform === "gitlab") {
    tasks.push({
      adapter: "gitlab",
      url: `https://gitlab.com/api/v4/users?username=${encoded}`,
      identity,
      parse: (d) =>
        arr(d).flatMap((r) =>
          fields(r, {
            username: ["online", "gitlab username"],
            name: ["identity", "name"],
            bio: ["identity", "biography"],
            web_url: ["online", "gitlab profile"],
          }),
        ),
    });
  } else if (social.platform === "dev")
    tasks.push({
      adapter: "dev",
      url: `https://dev.to/api/users/by_username?url=${encoded}`,
      identity,
      parse: (d) =>
        fields(d, {
          username: ["online", "DEV username"],
          name: ["identity", "name"],
          summary: ["identity", "biography"],
          website_url: ["online", "website"],
        }),
    });
  else if (social.platform === "huggingface")
    tasks.push({
      adapter: "huggingface",
      url: `https://huggingface.co/api/users/${encoded}/overview`,
      identity,
      parse: (d) =>
        fields(d, {
          name: ["online", "Hugging Face username"],
          fullname: ["identity", "name"],
          bio: ["identity", "biography"],
        }),
    });
  return tasks;
}
export function buildPlan(input: Input): {
  tasks: Task[];
  unsupported: Social[];
  skipped: Task[];
  queries: string[];
} {
  const s = input.subject,
    depth = input.research?.depth || "standard";
  const tasks: Task[] = [];
  const socials = (s.socials || []).map((p) => {
    if (!p.url) return { ...p, platform: p.platform.toLowerCase(), username: p.username?.replace(/^@/, "") };
    const normalized = normalizeSocial(p.url);
    if (
      p.platform.toLowerCase() !== normalized.platform ||
      (p.username &&
        p.username.replace(/^@/, "").toLowerCase() !==
          normalized.username?.toLowerCase())
    ) {
      throw new Error(
        "Social platform/username does not match its supplied profile URL: " +
          p.url,
      );
    }
    return normalized;
  });
  for (const p of socials) tasks.push(...accountTasks(p, depth, "anchored"));
  for (const username of s.usernames || [])
    for (const platform of depth === "quick"
      ? ["github"]
      : depth === "standard"
        ? ["github", "gitlab"]
        : ["github", "gitlab", "dev", "huggingface"])
      tasks.push(...accountTasks({ platform, username }, depth, "candidate"));
  const queries = [
    s.name && `"${s.name}"`,
    s.name &&
      s.professional?.company &&
      `"${s.name}" "${s.professional.company}"`,
    ...(s.education || []).map(
      (e) => s.name && `"${s.name}" "${String(e.institution || e.name || "")}"`,
    ),
  ].filter((x): x is string => !!x);
  if (s.name) {
    tasks.push({
      adapter: "github-search",
      url: `https://api.github.com/search/users?q=${encodeURIComponent(s.name + " in:fullname")}&per_page=${depth === "quick" ? 3 : depth === "standard" ? 6 : 12}`,
      identity: "candidate",
      parse: (d) =>
        arr(obj(d).items).map((r) => ({
          category: "online",
          field: "GitHub search candidate",
          value: str(obj(r).html_url),
          excerpt: "Name search match only; identity is not established.",
        })),
    });
    tasks.push({
      adapter: "wikidata-search",
      url: `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(s.name)}&language=en&format=json&limit=${depth === "quick" ? 3 : 8}`,
      identity: "candidate",
      parse: (d) =>
        arr(obj(d).search).map((r) => ({
          category: "identity",
          field: "Wikidata candidate",
          value: [
            str(obj(r).label),
            str(obj(r).description),
            str(obj(r).concepturi),
          ]
            .filter(Boolean)
            .join(" - "),
        })),
    });
    if (depth !== "quick")
      tasks.push({
        adapter: "crossref",
        url: `https://api.crossref.org/works?query.author=${encodeURIComponent(s.name)}&rows=${depth === "deep" ? 15 : 5}&select=DOI,title,author,published,URL`,
        identity: "candidate",
        parse: (d) =>
          arr(obj(obj(d).message).items).filter(r => matchingAuthors(s, obj(r).author).length > 0).map((r) => {
            const v = obj(r),
              parts = arr(obj(v.published)["date-parts"])[0];
            return {
              category: "publications",
              field: str(arr(v.title)[0]) || "Publication candidate",
              value: str(v.URL),
              excerpt: JSON.stringify({
                title: v.title,
                authors: arr(v.author).map((a) => ({
                  given: obj(a).given,
                  family: obj(a).family,
                  name: obj(a).name,
                  ORCID: obj(a).ORCID,
                })),
                DOI: v.DOI,
              }),
              date: { start: String(arr(parts)[0] || ""), precision: "year" },
            };
          }),
      });
  }
  const domains = new Set([
    ...(s.domains || []),
    ...(s.websites || []).map((w) => publicURL(w).hostname),
  ]);
  for (const domain of domains) {
    if (!/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(domain))
      throw new Error("Invalid public domain: " + domain);
    if (depth !== "quick")
      tasks.push({
        adapter: "rdap",
        url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
        identity: "anchored",
        parse: (d) => {
          const v = obj(d);
          return [
            {
              category: "technical",
              field: "domain",
              value: str(v.ldhName) || domain,
            },
            ...arr(v.nameservers).map((n) => ({
              category: "technical",
              field: "nameserver",
              value: str(obj(n).ldhName),
            })),
            ...arr(v.events)
              .filter((e) =>
                /registration|expiration/.test(str(obj(e).eventAction)),
              )
              .map((e) => ({
                category: "timeline",
                field: "Domain " + str(obj(e).eventAction),
                value: str(obj(e).eventDate),
                date: {
                  start: str(obj(e).eventDate).slice(0, 10),
                  precision: "day" as const,
                },
              })),
          ];
        },
      });
    tasks.push({
      adapter: "dns",
      url: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
      identity: "anchored",
      parse: (d) => {
        if (obj(d).Status !== 0 && obj(d).Status !== 3)
          throw new Error("DNS lookup failed; response status: " + String(obj(d).Status));
        return arr(obj(d).Answer)
          .filter((a) => obj(a).type === 1)
          .map((a) => ({
            category: "technical",
            field: `${domain} A record`,
            value: str(obj(a).data),
          }));
      },
    });
    if (depth === "deep")
      tasks.push({
        adapter: "internet-archive",
        url: `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain + "/")}&output=json&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:4&limit=10`,
        identity: "anchored",
        parse: (d) =>
          arr(d)
            .slice(1)
            .map((row) => {
              const r = arr(row),
                stamp = str(r[1]);
              return {
                category: "timeline",
                field: "Archived website",
                value: `https://web.archive.org/web/${stamp}/${str(r[2])}`,
                date: { start: stamp.slice(0, 4), precision: "year" },
              };
            }),
      });
  }
  const unique = tasks.filter(
    (t, i) => tasks.findIndex((x) => x.url === t.url) === i,
  );
  const limit = depth === "quick" ? 8 : depth === "standard" ? 30 : 70;
  return {
    skipped: unique.slice(limit),
    tasks: unique.slice(0, limit),
    unsupported: socials.filter(
      (p) =>
        !API_PLATFORMS.has(p.platform) ||
        !accountTasks(p, depth, "anchored").length,
    ),
    queries,
  };
}
export async function collect(
  task: Task,
  http: HttpClient,
  maxPages = 1,
): Promise<{ records: Candidate[]; retrieved_at: string; cached: boolean; payload: Json; final_url?: string; pages: number; limitation?: string }> {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 5) throw new Error("Page limit must be between 1 and 5.");
  const first = await http.get(task.url), responses = [first];
  const payloads: Json[] = [first.data];
  let next = first.next_url, limitation: string | undefined = first.pagination_error;
  // Only list endpoints with known pagination semantics may follow a provider's Link header.
  const paginated = ["github-projects", "github-organizations"].includes(task.adapter);
  const origin = publicURL(task.url), seen = new Set([origin.href]);
  while (paginated && next && responses.length < maxPages) {
    let url: URL;
    try { url = publicURL(next); }
    catch { limitation = "Pagination stopped: unsafe continuation URL."; break; }
    if (url.origin !== origin.origin || url.pathname !== origin.pathname ||
      [...url.searchParams.keys()].some(k => !origin.searchParams.has(k) && k !== "page") ||
      [...origin.searchParams.entries()].some(([k, v]) => url.searchParams.get(k) !== v) ||
      !/^[1-9]\d*$/.test(url.searchParams.get("page") || "") || seen.has(url.href)) {
      limitation = "Pagination stopped: untrusted or repeated continuation URL."; break;
    }
    seen.add(url.href);
    try {
      const response = await http.get(url.href);
      responses.push(response); payloads.push(response.data); next = response.next_url;
      if (response.pagination_error) { limitation = response.pagination_error; break; }
    } catch (e) {
      http.signal?.throwIfAborted();
      limitation = e instanceof SourceError ? e.code + ": " + e.message : (e as Error).message;
      break;
    }
  }
  if (paginated && next && !limitation) limitation = "Pagination limit reached; additional records may exist.";
  const records = responses.flatMap(r => task.parse(r.data)).filter(r => r.value.trim())
    .map(r => ({ ...r, identity: task.identity }));
  return { records, retrieved_at: first.retrieved_at, cached: responses.every(r => r.cached),
    payload: payloads.length === 1 ? first.data : { pages: payloads }, final_url: first.final_url,
    pages: responses.length, ...(limitation ? { limitation } : {}) };
}
