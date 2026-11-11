#!/usr/bin/env node
import { enrichPortrait } from "../reports/portrait.js";
import { balanceChange, summarizeUsage } from "../ai/usage.js";
import { DeepSeek, researchWithAI } from "../ai/deepseek.js";
import {
  getKey,
  password,
  saveCredential,
  forgetCredential,
  isNpx,
} from "../ai/credentials.js";
import { readFile, rm, lstat } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { Workspace, atomicJSON, atomicFile } from "../workspace/index.js";
import { investigate } from "../core/engine.js";
import { writeReport } from "../reports/html.js";
import { startServer } from "../server/index.js";
import { readLibrary, loadLibrary } from "../reports/library.js";
import { scanner, scanners } from "../legacy-commands/index.js";
import { parse, inputFromArgs, tokenize } from "./input.js";
import { questionnaire } from "./interactive.js";
import type { Input, Investigation } from "../core/types.js";
const HELP = `PH0MBER Gen2 — evidence-first public-source research

Usage: phomber <command> [options]
  wiki                         Interactive investigation builder
  wiki --social github:USER    Research a supplied public profile
  wiki --name NAME             Discover name matches as unverified leads
  wiki --input subject.json    Import schema-versioned input
  wiki --resume ID             Update a saved investigation using its stable ID
  serve [--port 4317]          Host saved reports on 127.0.0.1
  admin [--port 4317]         Show the local wiki management URL
  reports                     List saved investigations
  reports open ID             Open an offline HTML report
  reports export ID            Copy a portable report folder to exports/
  reports delete ID --yes      Permanently remove a saved investigation
  library [import FILE]       List or import archived wiki articles
  auth deepseek               Enter a hidden DeepSeek key (NPX: session-only)
  auth logout                 Delete the saved local key
  config                      Show local configuration
  cache clear --yes           Clear local cached source responses
  number|ip|mac|whois|dns|username TARGET    Legacy scanner equivalents
  help [COMMAND]              Show help
  info|check|dork|exp           Legacy utilities
  shell COMMAND               Explicitly execute a native shell command

Wiki options:
  --name --type --location    Scalar values override JSON input
  --alias --username --company --education --social --connection
  --website --domain --project    Repeatable; append to JSON input
  --depth quick|standard|deep --offline --omit FIELD (repeatable)
  --format text|json|html      Stdout format (all report files are saved)
  --output DIRECTORY          Export an additional portable report folder
  --no-serve --port NUMBER --open --help

With no command: interactive legacy shell in a terminal, help in scripts.
Shell-only: save [PATH], flush, clear, change [0-7], exit/quit.
Standalone scanners support --format json. Ctrl+C cancels collection and saves progress.
Default workspace: ~/.phomber (override PHOMBER_HOME for isolated use).
Wiki uses DeepSeek AI + Search/Fetch by default (billed to your key).
Use --no-ai for source-adapter-only research. --offline also disables AI.
--model MODEL overrides deepseek-flash; --save-key opts into NPX key persistence.
`;
let previous = "",
  color = 36;
function print(value: unknown, json = false): void {
  previous = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  process.stdout.write(previous + "\n");
}
function open(target: string): void {
  const exe =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "rundll32"
        : "xdg-open";
  const child = spawn(
    exe,
    process.platform === "win32"
      ? ["url.dll,FileProtocolHandler", target]
      : [target],
    { stdio: "ignore", detached: true },
  );
  child.on("error", () =>
    process.stderr.write(
      "Could not launch a browser. Open this URL manually: " + target + "\n",
    ),
  );
  child.unref();
}
async function host(
  workspace: Workspace,
  port: number,
  shouldOpen: boolean,
  id?: string,
): Promise<void> {
  const { server, url } = await startServer(workspace, port);
  const target = id ? `${url}/reports/${id}/` : url + "/";
  process.stderr.write(
    `Dashboard: ${url}/\n${id ? `Subject: ${target}\nJSON: ${target}profile.json\nSources: ${target}sources.json\n` : ""}Press Ctrl+C to stop the server.\n`,
  );
  if (shouldOpen) open(target);
  await new Promise<void>((resolve) => {
    const close = () => {
      server.closeAllConnections();
      server.close(() => resolve());
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    server.once("close", () => {
      process.off("SIGINT", close);
      process.off("SIGTERM", close);
      resolve();
    });
  });
}
async function execute(argv: string[], workspace: Workspace): Promise<void> {
  const command = argv[0] || "help";
  if (command === "shell") {
    const script = argv.slice(1).join(" ");
    if (!script) throw new Error("Usage: phomber shell <native command>");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(script, { shell: true, stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code) process.exitCode = code;
        resolve();
      });
    });
    return;
  }
  const args = parse(argv.slice(1));
  const v = args.values;
  if (
    command === "help" ||
    command === "--help" ||
    command === "-h" ||
    v.help
  ) {
    print(HELP);
    return;
  }
  if (command === "--version") {
    print("4.0.0-gen2.0");
    return;
  }
  if (command === "exit" || command === "quit") return;
  await workspace.init();
  const savedConfig = JSON.parse(
    await readFile(join(workspace.root, "config.json"), "utf8"),
  ) as { port?: number; ai?: { model?: string } };
  const port =
    v.port === undefined ? (savedConfig.port ?? 4317) : Number(v.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Port must be between 0 and 65535.");
  if (v.depth && !["quick", "standard", "deep"].includes(String(v.depth)))
    throw new Error("--depth must be quick, standard or deep.");
  if (v.format && !["text", "json", "html"].includes(String(v.format)))
    throw new Error("--format must be text, json or html.");
  if (command === "admin") {
    if(port===0) throw new Error("Use the running server’s actual port.");
    const target=`http://127.0.0.1:${port}/admin/`;
    print(target);
    if(v.open) open(target);
    return;
  }
  if (command === "serve") {
    await host(workspace, port, !!v.open);
    return;
  }
  if (command === "auth") {
    if (args.positionals[0] === "logout") {
      await forgetCredential(workspace);
      print("Saved DeepSeek key removed.");
      return;
    }
    if (args.positionals[0] !== "deepseek")
      throw new Error("Usage: phomber auth deepseek | auth logout");
    const key = await password();
    if (!isNpx() || v["save-key"]) {
      await saveCredential(workspace, key);
      print("DeepSeek key saved locally with restricted permissions.");
    } else
      print(
        "NPX keys are session-only. Run wiki to enter a key for that investigation; use --save-key to persist explicitly.",
      );
    return;
  }
  if (command === "config") {
    print({
      ...savedConfig,
      ai: {
        provider: "deepseek",
        model: savedConfig.ai?.model || "deepseek-flash",
        wiki_default: true,
        disable_with: "--no-ai",
      },
    });
    return;
  }
  if (command === "cache") {
    if (args.positionals[0] !== "clear" || !v.yes)
      throw new Error("Usage: phomber cache clear --yes");
    const { readdir } = await import("node:fs/promises");
    for (const file of await readdir(join(workspace.root, "cache")))
      if (/^[a-f0-9]{64}\.json$/.test(file))
        await rm(join(workspace.root, "cache", file));
    print("Cache cleared.");
    return;
  }
  if (command === "library") {
    if (!args.positionals.length) {
      print(
        (await loadLibrary(workspace)).articles.map((a) => ({
          id: a.id,
          title: a.title,
          filename: a.filename,
        })),
      );
      return;
    }
    if (args.positionals[0] !== "import" || !args.positionals[1])
      throw new Error("Usage: phomber library import references/library.json");
    const library = await readLibrary(args.positionals[1]);
    await atomicJSON(join(workspace.root, "library.json"), library);
    print(`Imported ${library.articles.length} archived wiki articles.`);
    return;
  }
  if (command === "reports") {
    const [action, id] = args.positionals;
    if (!action) {
      print(await workspace.list());
      return;
    }
    if (!id) throw new Error("A report ID is required.");
    if (action === "open") {
      const p = await workspace.safeReport(id);
      open(pathToFileURL(join(p, "index.html")).href);
      print(p);
    } else if (action === "export")
      print(
        await workspace.export(
          id,
          typeof v.output === "string" ? v.output : undefined,
        ),
      );
    else if (action === "delete") {
      if (!v.yes)
        throw new Error(
          "Deletion requires --yes. Export first if you need a copy.",
        );
      const path = await workspace.safeReport(id);
      await rm(path, { recursive: true });
      await workspace.updateIndex();
      print("Deleted " + id);
    } else throw new Error("Use reports open, export or delete.");
    return;
  }
  if (command === "wiki") {
    const old =
      typeof v.resume === "string" ? await workspace.load(v.resume) : undefined;
    const hasSubject =
      [
        "input",
        "name",
        "username",
        "company",
        "social",
        "website",
        "domain",
      ].some((k) => v[k] !== undefined) || old;
    let input: Input;
    if (!hasSubject) {
      input = await questionnaire();
      input = await inputFromArgs(args, input);
    } else input = await inputFromArgs(args, old?.input);
    if (v["synthesize-only"] && !old)
      throw new Error("--synthesize-only requires --resume REPORT_ID");
    const useAI = !v["no-ai"] && !input.research?.offline;
    if (useAI)
      process.stderr.write(
        "AI research sends this investigation's subject context and collected public evidence to DeepSeek for billed search, fetch and synthesis. No other reports are shared.\n",
      );
    const apiKey = useAI ? await getKey(workspace, !!v["save-key"]) : undefined;
    const controller = new AbortController(),
      cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    let inv: Investigation;
    try {
      inv =
        v["synthesize-only"] && old
          ? structuredClone(old)
          : await investigate(input, workspace, {
              resume: old,
              signal: controller.signal,
              progress:
                process.stderr.isTTY && v.format !== "json"
                  ? (s) => process.stderr.write("  · " + s + "\n")
                  : undefined,
            });
      if (apiKey && inv.status !== "interrupted") {
        inv.status = "running";
        await workspace.save(inv);
        const provider = new DeepSeek(apiKey, controller.signal);
        let balanceBefore: import("../adapters/http.js").Json = null;
        try {
          balanceBefore = await provider.request("/user/balance");
        } catch {
          /* Balance access is optional. */
        }
        try {
          await researchWithAI(
            inv,
            (path, body) => provider.request(path, body),
            {
              synthesisOnly: !!v["synthesize-only"],
              model:
                typeof v.model === "string" ? v.model : savedConfig.ai?.model,
              signal: controller.signal,
              checkpoint: async () => {
                const priorCalls = v["synthesize-only"]
                  ? old?.usage?.calls || []
                  : [];
                inv.usage = summarizeUsage([...priorCalls, ...provider.calls]);
                inv.updated_at = new Date().toISOString();
                await workspace.save(inv);
              },
              progress: process.stderr.isTTY
                ? (t) => process.stderr.write("  · " + t + "\n")
                : undefined,
            },
          );
        } catch (e) {
          inv.status = controller.signal.aborted ? "interrupted" : "partial";
          inv.warnings.push("AI research incomplete: " + (e as Error).message);
        }
        const priorCalls = v["synthesize-only"] ? old?.usage?.calls || [] : [];
        inv.usage = summarizeUsage([...priorCalls, ...provider.calls]);
        if (!controller.signal.aborted) {
          try {
            const after = await provider.request("/user/balance");
            inv.usage.balance_change = balanceChange(balanceBefore, after);
          } catch {
            /* Usage-based estimate remains available. */
          }
        }
        inv.updated_at = new Date().toISOString();
      }
    } finally {
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
    }
    const finished_at = new Date().toISOString();
    inv.research_timing = {
      started_at: inv.research_timing?.started_at || inv.created_at,
      finished_at,
      duration_ms:
        Date.parse(finished_at) -
        Date.parse(inv.research_timing?.started_at || inv.created_at),
    };
    if (!input.research?.offline) {
      try {
        await enrichPortrait(inv, workspace);
      } catch {
        inv.warnings.push(
          "Profile portrait could not be retrieved; no image was inferred.",
        );
      }
    }
    const path = await writeReport(inv, workspace);
    if (v.output) await workspace.export(inv.id, String(v.output));
    if (v.format === "json") print(inv, true);
    else if (v.format === "html") print(join(path, "index.html"));
    else
      print(
        `${inv.summary}\nReport: ${join(path, "index.html")}\nInvestigation: ${inv.id}\nWorkspace: ${workspace.root}`,
      );
    if (inv.status === "interrupted") {
      process.exitCode = 130;
      return;
    }
    if (!v["no-serve"] && v.format !== "json" && process.stdout.isTTY)
      await host(workspace, port, !!v.open, inv.id);
    else if (v.open) open(pathToFileURL(join(path, "index.html")).href);
    return;
  }
  if (scanners.includes(command)) {
    const controller = new AbortController(),
      cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    try {
      print(
        await scanner(
          command,
          args.positionals.join(" "),
          workspace,
          controller.signal,
        ),
        v.format === "json",
      );
    } finally {
      process.off("SIGINT", cancel);
    }
    return;
  }
  throw new Error("Unknown command: " + command + ". Run phomber help.");
}
async function shell(workspace: Workspace): Promise<void> {
  await workspace.init();
  let history: string[] = [];
  try {
    history = JSON.parse(
      await readFile(join(workspace.root, "history.json"), "utf8"),
    );
  } catch {}
  const names = [
    "help",
    "wiki",
    "reports",
    "library",
    "serve",
    "config",
    ...scanners,
    "shell",
    "save",
    "flush",
    "clear",
    "change",
    "exit",
    "quit",
  ];
  process.stdout.write("PH0MBER Gen2 · Type help to begin.\n");
  for (;;) {
    // Close the outer editor before a command opens its own questionnaire.
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      history,
      completer: (line) => [names.filter((n) => n.startsWith(line)), line],
    });
    let line: string;
    try {
      line = await rl.question(`\x1b[${color}mphomber :) >\x1b[0m `);
    } finally {
      rl.close();
    }
    if (!line.trim()) continue;
    if (["exit", "quit"].includes(line.trim())) break;
    try {
      const parts = tokenize(line),
        cmd = parts[0];
      if (cmd === "clear") {
        process.stdout.write("\x1b[2J\x1b[H");
        continue;
      }
      if (cmd === "flush") {
        history = [];
        await atomicJSON(join(workspace.root, "history.json"), []);
        print("History cleared.");
        continue;
      }
      if (cmd === "change") {
        const n = Number(parts[1] ?? "6");
        if (!Number.isInteger(n) || n < 0 || n > 7)
          throw new Error("change accepts 0–7.");
        color = 30 + n;
        continue;
      }
      if (cmd === "save") {
        if (!previous) throw new Error("No previous output.");
        const file =
          parts[1] ||
          join(workspace.root, "exports", `scanner-${Date.now()}.txt`);
        await atomicFile(file, previous + "\n");
        process.stdout.write("Saved " + file + "\n");
        continue;
      }
      // Persist command names only, avoiding arguments with personal data or secrets.
      if (cmd && cmd !== "shell") {
        history.push(cmd);
        history = history.slice(-100);
        await atomicJSON(join(workspace.root, "history.json"), history);
      }
      await execute(
        cmd === "shell" ? ["shell", line.slice(5).trim()] : parts,
        workspace,
      );
    } catch (e) {
      process.stderr.write("Error: " + (e as Error).message + "\n");
    }
  }
}
const workspace = new Workspace();
try {
  if (process.argv.length === 2 && process.stdin.isTTY) await shell(workspace);
  else await execute(process.argv.slice(2), workspace);
} catch (e) {
  process.stderr.write("Error: " + (e as Error).message + "\n");
  process.exitCode = 1;
}
