type Topic = {
  summary: string;
  usage: string;
  options?: string[];
  examples?: string[];
  notes?: string[];
};

const scannerTopics: Record<string, Topic> = {
  number: {
    summary: "Check phone-number format and numbering-plan metadata offline.",
    usage: "number +COUNTRY_CODE_AND_NUMBER [--format json]",
    examples: ["number +442079460000", "number +442079460000 --format json"],
    notes: ["Does not identify a subscriber, current carrier, ownership or live location."],
  },
  ip: {
    summary: "Look up public IPv4 registration information through RDAP.",
    usage: "ip PUBLIC_IPV4 [--format json]",
    examples: ["ip 8.8.8.8"],
    notes: ["IPv6 and private addresses are unsupported. Contact entities are omitted."],
  },
  mac: {
    summary: "Look up the vendor associated with a MAC address prefix.",
    usage: "mac MAC_ADDRESS [--format json]",
    examples: ["mac 00:1A:2B:00:00:00"],
    notes: ["Locally administered or multicast addresses have no reliable vendor inference.",
      "A vendor match does not identify a device or its owner."],
  },
  whois: {
    summary: "Look up domain registration information through RDAP.",
    usage: "whois DOMAIN [--format json]",
    examples: ["whois example.com"],
    notes: ["Uses RDAP rather than the legacy WHOIS protocol. Contact entities are omitted."],
  },
  dns: {
    summary: "Query domain DNS records or reverse DNS for an IP address.",
    usage: "dns DOMAIN_OR_IP [--format json]",
    examples: ["dns example.com", "dns 8.8.8.8"],
    notes: ["Domains: A, AAAA, MX, NS, TXT and SOA. IP addresses: PTR.",
      "An unavailable record type does not establish that a domain is absent."],
  },
  username: {
    summary: "Check candidate handles on GitHub, GitLab, DEV and Hugging Face.",
    usage: "username HANDLE [--format json]",
    examples: ["username octocat", "username octocat --format json"],
    notes: ["Matching handles are leads, not proof of common ownership.",
      "Failed lookups do not prove an account is absent."],
  },
};

const topics: Record<string, Topic> = {
  wiki: {
    summary: "Build a public-source investigation, or update a saved one.",
    usage: "wiki [subject options] [research options]",
    options: [
      "Subject (scalar; override JSON input):",
      "  --name NAME --type TYPE --location TEXT",
      "Subject (repeatable; append to JSON input):",
      "  --alias TEXT --username HANDLE --social PLATFORM:HANDLE_OR_URL",
      "  --company TEXT --education TEXT --connection TEXT",
      "  --website URL --domain DOMAIN --project TEXT",
      "Input and resume:",
      "  --input FILE             Read schema-versioned subject JSON",
      "  --resume REPORT_ID       Update a saved investigation",
      "  --synthesize-only        Regenerate AI prose from saved evidence",
      "Research:",
      "  --depth quick|standard|deep  Default: standard",
      "  --no-ai / --ai           Disable / explicitly enable AI sharing",
      "  --ai-only                Use DeepSeek only; skip adapters and portraits",
      "  --offline / --online     Use fresh cache only / enable network access",
      "  --omit FIELD             Omit an input category (repeatable)",
      "  --model MODEL            Override the configured/discovered AI model",
      "  --max-ai-calls NUMBER    Cap provider attempts (default: 100; max: 1000)",
      "  --max-output-tokens N    Cap each model output (default: 12000; max: 32000)",
      "  --save-key               Explicitly persist an NPX session key",
      "Output:",
      "  --format text|json|html  Select stdout format; report files are still saved",
      "  --output DIRECTORY      Export an additional portable report folder",
      "  --no-serve               Finish without starting the wiki server",
      "  --port NUMBER --open     Choose a server port / open the report",
    ],
    examples: [
      "wiki --no-ai",
      "wiki --social github:octocat --no-ai --no-serve",
      'wiki --name "YOUR SUBJECT" --ai-only --no-serve',
      'wiki --name "YOUR SUBJECT" --company "KNOWN CONTEXT" --no-ai --no-serve',
      "wiki --input subject.json --offline --no-serve",
      "wiki --resume REPORT_ID --no-ai --no-serve",
      "wiki --resume REPORT_ID --online --ai --synthesize-only --no-serve",
    ],
    notes: [
      "Without a subject, wiki opens a guided questionnaire in a terminal.",
      "New investigations use billed DeepSeek AI by default; --no-ai disables it.",
      "--no-ai and --offline are saved preferences; --ai and --online override them.",
      "Offline mode always disables AI. Source failures can produce partial reports.",
      "Synthesis-only requires online AI and unchanged subject, evidence and omissions.",
      "Ctrl+C cancels collection and saves progress. Resume with the same report ID.",
    ],
  },
  serve: {
    summary: "Browse past investigations and archived articles in the local wiki.",
    usage: "serve [--port NUMBER] [--open]",
    examples: ["serve --open", "serve --port 4320 --open"],
    notes: [
      "Starts on 127.0.0.1; the default port is 4317 unless configured otherwise.",
      "Open the printed URL. If the port is busy, the actual port may change.",
      "Reads saved reports from the current workspace; it does not run new research.",
      "In this checkout: npm run local -- serve --open (build first).",
      "Or run npm run dev to rebuild and serve the checkout's .phomber/ workspace.",
      "Use the same PHOMBER_HOME as the investigation. Ctrl+C stops the server.",
    ],
  },
  reports: {
    summary: "List, open, export or delete saved investigations.",
    usage: "reports [open|export|delete REPORT_ID]",
    options: [
      "reports                              List saved reports and their IDs",
      "reports open REPORT_ID               Open the saved offline HTML",
      "reports export REPORT_ID             Export into the workspace's exports/",
      "reports export REPORT_ID --output DIR  Choose an export destination",
      "reports delete REPORT_ID --yes       Permanently delete the report",
    ],
    examples: ["reports", "reports open REPORT_ID", "reports export REPORT_ID"],
    notes: ["Use serve --open to browse all saved reports in the wiki.",
      "Deletion includes revisions and snapshots; separate exports and cache remain."],
  },
  review: {
    summary: "Inspect finding assessments or record an analyst decision.",
    usage: "review REPORT_ID [FINDING_ID --decision VALUE --identity VALUE --analyst NAME --reason TEXT]",
    options: [
      "--decision accepted|rejected|needs-review",
      "--identity unresolved|matched|different  Default: unresolved",
      "--analyst NAME --reason TEXT             Both required for a decision",
    ],
    examples: ["review REPORT_ID",
      'review REPORT_ID FINDING_ID --decision needs-review --identity unresolved --analyst "Your name" --reason "Identity needs checking."'],
    notes: ["Changed evidence makes earlier decisions stale. Reviews clear existing AI prose.",
      "A finding assessed as a different identity cannot be accepted.",
      "The wiki's Review findings page offers the same workflow with source excerpts."],
  },
  history: {
    summary: "List preserved report revisions and their hashes.",
    usage: "history REPORT_ID", examples: ["history REPORT_ID"],
  },
  diff: {
    summary: "Compare a preserved revision with the current report's findings.",
    usage: "diff REPORT_ID REVISION_HASH", examples: ["diff REPORT_ID REVISION_HASH"],
    notes: ["Use history REPORT_ID to find a revision hash."],
  },
  verify: {
    summary: "Check hashes of preserved revisions and referenced source snapshots.",
    usage: "verify REPORT_ID", examples: ["verify REPORT_ID"],
    notes: ["Reports successful sources without snapshots separately.",
      "Integrity checks detect retained-content changes, not factual truth or ownership."],
  },
  search: {
    summary: "Search local investigation findings and AI article text.",
    usage: "search QUERY", examples: ['search "project name"'],
    notes: ["Uses a rebuildable SQLite index where available, otherwise a local scan."],
  },
  library: {
    summary: "List archived wiki articles or import a validated article collection.",
    usage: "library [import FILE]",
    examples: ["library", "library import references/library.json"],
  },
  admin: {
    summary: "Show the management URL for an already running local wiki server.",
    usage: "admin [--port NUMBER] [--open]", examples: ["admin --port 4317 --open"],
    notes: ["Does not start a server. Use serve first and supply its actual port."],
  },
  auth: {
    summary: "Enter a hidden DeepSeek API key or remove the saved key.",
    usage: "auth deepseek [--save-key] | auth logout",
    examples: ["auth deepseek", "auth logout"],
    notes: ["DEEPSEEK_API_KEY supplies an environment key without saving it.",
      "Installed execution saves keys locally; NPX sessions require --save-key to persist.",
      "Use wiki to enter a session key for an NPX investigation. Never pass keys as arguments."],
  },
  config: {
    summary: "Show local configuration and the configured AI model.",
    usage: "config", examples: ["config"],
  },
  cache: {
    summary: "Clear cached public-source responses from the current workspace.",
    usage: "cache clear --yes", examples: ["cache clear --yes"],
    notes: ["Does not delete saved reports, revisions, source snapshots or exports."],
  },
  ...scannerTopics,
  check: {
    summary: "Check public API connectivity with a fallback endpoint.",
    usage: "check", examples: ["check"],
    notes: ["Tries GitHub, then Google public DNS. This is not the code test suite.",
      "A fresh cached response may satisfy this check without a new network request.",
      "Run npm run release:check in the checkout to validate the code and package."],
  },
  dork: {
    summary: "Print a public-research search query template.",
    usage: "dork", examples: ["dork"],
    notes: ["Replace YOUR SUBJECT in the returned template and review search results manually.",
      "This command does not execute a web search."],
  },
  info: {
    summary: "Show PH0MBER version, Node runtime, platform and workspace path.",
    usage: "info", examples: ["info"],
  },
  exp: {
    summary: "Explain the legacy terminal status emoticons.",
    usage: "exp", examples: ["exp"],
  },
  shell: {
    summary: "Explicitly execute a command through the native operating-system shell.",
    usage: "shell COMMAND", examples: ['shell "echo hello"'],
    notes: ["To enter PH0MBER's interactive prompt, run phomber with no arguments.",
      "shell COMMAND executes a native command; it does not open the PH0MBER prompt."],
  },
  interactive: {
    summary: "Use PH0MBER's interactive terminal prompt.",
    usage: "(no arguments, in a terminal)",
    options: [
      "help [COMMAND]  Show overview or command help",
      "save [PATH]     Save the last captured command result",
      "flush           Clear persisted command history",
      "clear           Clear the terminal screen",
      "change 0-7      Change the prompt color",
      "exit / quit     Leave the interactive prompt",
    ],
    notes: ["Enter commands without the phomber prefix; Tab completes command names.",
      "wiki opens the investigation questionnaire. serve hosts the saved wiki until Ctrl+C.",
      "In this checkout, npm run local opens the same prompt after building.",
      "With no arguments in a script or pipe, PH0MBER prints help instead."],
  },
  help: {
    summary: "Show a short overview or detailed command help.",
    usage: "help [COMMAND|scanners|interactive]",
    examples: ["help", "help wiki", "help scanners", "number --help"],
    notes: ["Both help COMMAND and COMMAND --help show command-specific help."],
  },
};

export const interactiveCommands = [
  ...Object.keys(topics).filter(name => name !== "interactive"),
  "save", "flush", "clear", "change", "exit", "quit",
];

const overview = `PH0MBER Gen2 — OSINT Researcher and a local investigation wiki

Usage: phomber <command> [options]
       phomber                     Open the interactive terminal

Start here
  wiki                             Guided investigation builder
  serve --open                     Browse past investigations in the wiki
  help COMMAND                     Options and examples for one command

Saved investigations and evidence
  reports                          List reports and their IDs
  reports open|export|delete ID     Open, export or delete a report
  review ID [FINDING_ID]            Inspect findings or record a review
  history ID                       List preserved report revisions
  diff ID REVISION_HASH             Compare a revision with current findings
  verify ID                        Check preserved evidence integrity
  search "QUERY"                   Search local findings and article text
  library [import FILE]            List or import archived wiki articles

Legacy scanners
  number +PHONE                    Offline phone-number metadata
  ip PUBLIC_IPV4                   IP registration via RDAP
  mac MAC_ADDRESS                  MAC vendor lookup
  whois DOMAIN                     Domain registration via RDAP
  dns DOMAIN_OR_IP                 DNS records or reverse DNS
  username HANDLE                  Candidate handles across four platforms

Utilities
  info / check                     Runtime details / API connectivity
  dork / exp                       Search template / legacy status symbols
  admin [--open]                   Management URL for a running wiki server
  auth deepseek / auth logout      Enter or remove a saved AI key
  config / cache clear --yes       View settings / clear response cache
  shell COMMAND                    Explicitly execute a native shell command
  --version                        Show version

Examples
  phomber wiki --social github:octocat --no-ai --no-serve
  phomber number +442079460000 --format json
  phomber serve --open

New wiki investigations use billed AI by default. Use --no-ai to disable it.
Use wiki --ai-only for DeepSeek Search/Fetch without adapters or portrait downloads.
Installed workspace: ~/.phomber; override with PHOMBER_HOME.
In this checkout: npm run local -- <command> uses .phomber/ unless overridden.
Run npm run dev to rebuild and serve that checkout workspace.
More help: phomber help wiki | phomber help scanners | phomber help interactive
`;

function render(name: string, topic: Topic): string {
  return [
    `PH0MBER Gen2 — ${name}`,
    topic.summary,
    `\nUsage: phomber ${topic.usage}`,
    ...(topic.options ? ["\nOptions and actions:", ...topic.options.map(line => `  ${line}`)] : []),
    ...(topic.examples ? ["\nExamples:", ...topic.examples.map(line => `  phomber ${line}`)] : []),
    ...(topic.notes ? ["\nNotes:", ...topic.notes.map(line => `  ${line}`)] : []),
    "\nUse phomber help for the command overview.",
    "In the interactive prompt, omit the phomber prefix.\n",
  ].join("\n");
}

export function helpText(topic?: string): string {
  if (!topic) return overview;
  if (topic === "scanners")
    return [
      "PH0MBER Gen2 — legacy scanners",
      "\nUsage: phomber <scanner> TARGET [--format json]",
      "\nScanners:",
      ...Object.entries(scannerTopics).map(([name, entry]) => `  ${name}\n    ${entry.summary}`),
      "\nExamples:",
      ...Object.values(scannerTopics).map(entry => `  phomber ${entry.examples![0]}`),
      "\nnumber works offline. Other scanners can require network access.",
      "Matches and registration data do not establish ownership or identity.",
      "Use phomber help SCANNER for its formats, examples and limitations.",
      "In the interactive prompt, omit the phomber prefix.\n",
    ].join("\n");
  if (["save", "flush", "clear", "change", "exit", "quit"].includes(topic))
    return render("interactive", topics.interactive!);
  if (!Object.hasOwn(topics, topic))
    throw new Error(`Unknown help topic: ${topic}. Run phomber help for available commands.`);
  return render(topic, topics[topic]!);
}
