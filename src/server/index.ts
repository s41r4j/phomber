import { renderWorkbench, renderRevisions, provenanceGraph } from "../reports/workbench.js";
import { validateInvestigation } from "../core/schema.js";
import { writeReport } from "../reports/html.js";
import {Collections} from "../admin/collections.js";
import {renderAdmin,renderAdminCollections} from "../reports/admin.js";
import { renderDeleteReport, renderManageReports } from "../reports/manage.js";
import {brandMark} from "../reports/branding.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Catalog } from "../catalog/index.js";
import {
  renderBiography,
  renderEvidence,
  renderReportInfo,
} from "../reports/article.js";
import {
  renderCatalog,
  renderProfile,
  renderAbout,
  renderCollections,
  renderCollection,
  renderActivity,
  renderArchiveInfo,
} from "../reports/catalog-pages.js";
import { createServer, type Server } from "node:http";
import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { loadLibrary } from "../reports/library.js";
import { Workspace, validId } from "../workspace/index.js";
import { renderDashboard, renderArchive, csp } from "../reports/html.js";
export async function startServer(
  workspace: Workspace,
  port = 4317,
): Promise<{ server: Server; url: string }> {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Port must be between 0 and 65535.");
  await workspace.init();
  const library = await loadLibrary(workspace);
  const catalog = new Catalog(workspace),
    csrf = randomBytes(32).toString("hex");
  const collections=new Collections(workspace);
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    // no-referrer makes native form POSTs send Origin: null in browsers.
    // Keep same-origin form checks usable without sending referrers externally.
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    const host = req.headers.host || "";
    if (!/^127\.0\.0\.1:\d+$/.test(host)) {
      res.writeHead(403);
      res.end("Invalid host");
      return;
    }
    if (req.method === "POST" && ['/manage/profiles','/manage/collections','/manage/reviews','/manage/reports'].includes(req.url||'')) {
      try {
        if(req.headers.origin!==`http://${host}` || req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded')throw new Error('Invalid origin');
        let bytes=0,body='';for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>65536)throw new Error('Form too large');body+=chunk;}
        const form=new URLSearchParams(body),provided=form.get('csrf')||'';
        if(Buffer.byteLength(provided)!==Buffer.byteLength(csrf)||!timingSafeEqual(Buffer.from(provided),Buffer.from(csrf)))throw new Error('Invalid form token');
        let location='/admin/';
        if(req.url==='/manage/reports') {
          if (form.get('action') !== 'delete' || form.get('confirm') !== 'yes' || !/^[a-f0-9]{64}$/.test(form.get('revision') || ''))
            throw new Error('Deletion needs confirmation from the current report page.');
          await workspace.deleteReport(form.get('report') || '', form.get('revision')!);
          location = '/admin/reports/';
        } else if(req.url==='/manage/reviews') {
          const id = form.get('report') || '';
          await workspace.review(id, form.get('finding') || '', form.get('revision') || '', {
            decision: form.get('decision') || '', identity: form.get('identity') || '',
            reason: form.get('reason') || '', analyst: form.get('analyst') || '',
          });
          await writeReport(await workspace.load(id), workspace);
          location = '/reports/' + id + '/review/';
        } else if(req.url==='/manage/collections'){
          await collections.save(form,new Set((await catalog.read()).map(p=>p.id)));location='/admin/collections/';
        }else {
          const action=form.get('action');let id:string;
          if(action==='rename'){id=form.get('profile')||'';await catalog.rename(id,form.get('title')||'');}
          else if(action==='split'||action==='move')id=await catalog.move(form.get('article')||'',action==='move'?form.get('target')||'invalid':undefined);
          else throw new Error('Unknown action');location='/profiles/'+id+'/';
        }
        res.writeHead(303,{Location:location});res.end();
      }catch(e){const stale = (e as Error).message.startsWith('Report changed.');res.writeHead(stale ? 409 : 403);res.end(stale ? 'Report changed. Refresh this page before retrying.' : 'Management request rejected. Use a valid form from this local wiki.');}
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    try {
      const raw = (req.url || "/").split("?")[0]!;
      if (/%2e|%2f|%5c|\\|\.\./i.test(raw)) {
        res.writeHead(400);
        res.end("Invalid path");
        return;
      }
      const path = decodeURIComponent(raw);
      const sendHTML = (html: string) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(req.method === "HEAD" ? "" : html);
      };
      if (path === '/admin/reports/') {
        sendHTML(renderManageReports(await workspace.list())); return;
      }
      const deletePage = /^\/reports\/([a-z0-9-]+)\/delete\/$/.exec(path);
      if (deletePage && validId(deletePage[1]!)) {
        sendHTML(renderDeleteReport(await workspace.load(deletePage[1]!), csrf)); return;
      }
      const researchPage = /^\/reports\/([a-z0-9-]+)\/(review|revisions)\/$/.exec(path);
      if (researchPage && validId(researchPage[1]!)) {
        const inv = await workspace.load(researchPage[1]!);
        if (researchPage[2] === "review") sendHTML(renderWorkbench(inv, csrf));
        else {
          const compare = new URL(req.url || "/", `http://${host}`).searchParams.get("compare");
          const previous = compare ? validateInvestigation(await workspace.readObject(inv.id, "revisions", compare)) : undefined;
          sendHTML(renderRevisions(inv, await workspace.history(inv.id), previous));
        }
        return;
      }
      const objectRoute = /^\/reports\/([a-z0-9-]+)\/(revisions|snapshots)\/([a-f0-9]{64})\.json$/.exec(path);
      if (objectRoute && validId(objectRoute[1]!)) {
        const data = await workspace.readObject(objectRoute[1]!, objectRoute[2] as "revisions" | "snapshots", objectRoute[3]!);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(req.method === "HEAD" ? "" : JSON.stringify(data, null, 2)); return;
      }
      const graphRoute = /^\/reports\/([a-z0-9-]+)\/graph\.json$/.exec(path);
      if (graphRoute && validId(graphRoute[1]!)) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(req.method === "HEAD" ? "" : JSON.stringify(provenanceGraph(await workspace.load(graphRoute[1]!)), null, 2)); return;
      }
      if(path==='/favicon.svg'||path==='/logo.svg'){
        res.setHeader('Content-Type','image/svg+xml');res.end(req.method==='HEAD'?'':brandMark);return;
      }
      if(path==='/admin/'||path==='/admin/collections/'){
        sendHTML(path==='/admin/collections/'?renderAdminCollections(await collections.read(),await catalog.read(),csrf):renderAdmin());return;
      }
      const collectionMatch=/^\/collections\/(collection-[a-f0-9-]{36})\/$/.exec(path);
      if(collectionMatch){const c=(await collections.read()).find(c=>c.id===collectionMatch[1]);if(!c){res.writeHead(404);res.end('Collection not found');return;}sendHTML(renderCollection(c,await catalog.read()));return;}
      if (
        ["/", "/articles/", "/about/", "/collections/", "/activity/"].includes(
          path,
        )
      ) {
        const profiles = await catalog.read();
        const params = new URL(req.url || '/', `http://${host}`).searchParams;
        const query = params.get('search') || '';
        if (query.length > 4096) { res.writeHead(400); res.end('Search query is too long.'); return; }
        const kind = ['research', 'archive'].includes(params.get('collection') || '') ? params.get('collection')! : 'all';
        sendHTML(
          path === "/about/"
            ? renderAbout()
            : path === "/collections/"
              ? renderCollections(profiles,await collections.read())
              : path === "/activity/"
                ? renderActivity(profiles)
                : renderCatalog(profiles, path === "/", query, kind),
        );
        return;
      }
      const profiles = await catalog.read();
      const profileMatch = /^\/profiles\/(profile-[a-f0-9-]{36})\/$/.exec(path);
      if (profileMatch) {
        const profile = profiles.find((p) => p.id === profileMatch[1]);
        if (!profile) {
          const replacement = profiles.find(p => p.aliases?.includes(profileMatch[1]!));
          if (replacement) { res.writeHead(303, { Location: `/profiles/${replacement.id}/` }); res.end(); return; }
          res.writeHead(404);
          res.end("Profile not found");
          return;
        }
        sendHTML(renderProfile(profile, profiles, csrf));
        return;
      }
      const sectionMatch =
        /^\/(reports|wiki)\/([a-z0-9-]+)\/(info|evidence|history)\/$/.exec(
          path,
        );
      if (sectionMatch) {
        const kind = sectionMatch[1] === "reports" ? "research" : "archive",
          article = profiles
            .flatMap((p) => p.articles)
            .find((a) => a.id === sectionMatch[2] && a.kind === kind),
          profile = profiles.find((p) => p.id === article?.profile_id);
        if (!article || !profile) {
          res.writeHead(404);
          res.end("Article not found");
          return;
        }
        if (sectionMatch[3] === "history") {
          res.writeHead(303, { Location: "/profiles/" + profile.id + "/" });
          res.end();
          return;
        }
        sendHTML(
          article.inv
            ? sectionMatch[3] === "evidence"
              ? renderEvidence(article.inv)
              : renderReportInfo(article.inv)
            : renderArchiveInfo(article, profile),
        );
        return;
      }
      const wikiMatch = /^\/wiki\/([a-z0-9-]+)\/$/.exec(path);
      if (wikiMatch) {
        const article = library.articles.find((a) => a.id === wikiMatch[1]);
        if (!article) {
          res.writeHead(404);
          res.end("Article not found");
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          req.method === "HEAD"
            ? ""
            : renderArchive(
                article,
                library,
                profiles
                  .flatMap((p) => p.articles)
                  .find((a) => a.kind === "archive" && a.id === article.id)
                  ?.profile_id
                  ? "/profiles/" +
                      profiles
                        .flatMap((p) => p.articles)
                        .find(
                          (a) => a.kind === "archive" && a.id === article.id,
                        )!.profile_id +
                      "/"
                  : undefined,
              ),
        );
        return;
      }
      const match =
        /^\/reports\/([a-z0-9-]+)\/(index\.html|profile\.json|sources\.json|evidence\.json|connections\.json|timeline\.json|usage\.json|export\.json)?$/.exec(
          path,
        );
      if (!match || !validId(match[1]!)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const id = match[1]!,
        file = match[2] || "index.html";
      if (file === "export.json") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${id}.json"`,
        );
        res.end(
          req.method === "HEAD"
            ? ""
            : JSON.stringify(await workspace.load(id), null, 2),
        );
        return;
      }
      if (file === "index.html") {
        const article = profiles
          .flatMap((p) => p.articles)
          .find((a) => a.kind === "research" && a.id === id);
        const inv = article?.inv || (await workspace.load(id));
        sendHTML(
          renderBiography(
            inv,
            article?.profile_id
              ? "/profiles/" + article.profile_id + "/"
              : undefined,
            article?.version,
            true,
          ),
        );
        return;
      }
      const folder = await workspace.safeReport(id),
        target = join(folder, file);
      if (!(await lstat(target)).isFile())
        throw new Error("Not a regular file");
      const data = await readFile(target);
      res.setHeader(
        "Content-Type",
        file.endsWith(".html")
          ? "text/html; charset=utf-8"
          : "application/json; charset=utf-8",
      );
      res.end(req.method === "HEAD" ? "" : data);
    } catch (e) {
      res.writeHead((e as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 400);
      res.end("Report unavailable");
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  let selected = port;
  for (let tries = 0; ; tries++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const error = (e: Error) => {
          server.off("listening", ready);
          reject(e);
        };
        const ready = () => {
          server.off("error", error);
          resolve();
        };
        server.once("error", error);
        server.once("listening", ready);
        server.listen(selected, "127.0.0.1");
      });
      break;
    } catch (e) {
      if (
        (e as NodeJS.ErrnoException).code !== "EADDRINUSE" ||
        tries >= 9 ||
        selected === 0
      )
        throw e;
      selected++;
      if (selected > 65535) throw e;
    }
  }
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No listening address");
  return { server, url: `http://127.0.0.1:${address.port}` };
}
