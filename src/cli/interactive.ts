import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { atomicJSON } from "../workspace/index.js";
import { validateInput } from "../core/schema.js";
import { normalizeSocial } from "../adapters/index.js";
import type { Input, Depth } from "../core/types.js";
export async function questionnaire(base?: Input): Promise<Input> {
  if (!stdin.isTTY)
    throw new Error(
      "Interactive wiki requires a terminal. Use --name, --social or --input in scripts.",
    );
  const rl = createInterface({ input: stdin, output: stderr });
  const data: Input = base
    ? structuredClone(base)
    : {
        schema_version: "1.0",
        subject: { type: "person" },
        research: { depth: "standard" },
        output: ["html", "json"],
      };
  const ask = async (label: string, old = "") => {
    const value = await rl.question(`${label}${old ? " [" + old + "]" : ""}: `);
    return value.trim() || old;
  };
  const lines = async (label: string, existing: string[] = []) => {
    const result = [...existing];
    stderr.write(
      `${label}: one per line; blank finishes. Enter !clear first to replace existing entries.\n`,
    );
    for (;;) {
      const answer = await ask("  +");
      if (!answer) break;
      if (answer === "!clear") result.length = 0;
      else result.push(answer);
    }
    return result;
  };
  try {
    stderr.write(
      "\n PH0MBER Gen2 / Investigation builder\n Optional questions may be skipped. Return to any category to edit.\n",
    );
    if (!base) {
      data.subject.name = (await ask("Subject name (optional)")) || undefined;
      if (!data.subject.name)
        data.subject.usernames = await lines(
          "Known usernames (or return to identity later)",
        );
    }
    for (;;) {
      stderr.write(
        "\n 1 Identity & context     2 Online profiles\n 3 Education & work       4 Projects & connections\n 5 Research options       6 Review\n 7 Save input JSON        8 Start investigation\n",
      );
      const choice = await ask("Choose category / action", "8");
      const s = data.subject;
      if (choice === "1") {
        s.name = (await ask("Full name", s.name)) || undefined;
        s.type = await ask("Entity type", s.type || "person");
        s.aliases = await lines("Aliases", s.aliases);
        s.location =
          (await ask("General public location", s.location)) || undefined;
      } else if (choice === "2") {
        s.usernames = await lines(
          "Usernames (unverified cross-platform candidates)",
          s.usernames,
        );
        const socials = await lines("Profiles: platform:username or HTTPS URL");
        for (const value of socials) {
          try {
            (s.socials ??= []).push(normalizeSocial(value));
          } catch (e) {
            stderr.write((e as Error).message + "\n");
          }
        }
        s.websites = await lines("Public HTTPS websites", s.websites);
        if ((await ask("Clear all social profiles? yes/no", "no")) === "yes")
          s.socials = [];
      } else if (choice === "3") {
        const companies = await lines(
          "Companies (public professional context)",
          s.professional?.companies,
        );
        s.professional = {
          ...s.professional,
          company: companies[0],
          companies,
        };
        const education = await lines(
          "Educational institutions",
          (s.education || []).map((e) => String(e.institution || e.name || "")),
        );
        s.education = education.map((institution) => ({ institution }));
      } else if (choice === "4") {
        s.projects = (
          await lines(
            "Known projects",
            (s.projects || []).map((p) => String(p.name || "")),
          )
        ).map((name) => ({ name }));
        s.connections = (
          await lines(
            "Public professional connections",
            (s.connections || []).map((c) => String(c.name || "")),
          )
        ).map((name) => ({
          name,
          relationship: "investigator supplied; unverified",
        }));
        s.custom = {
          ...s.custom,
          notes: await ask(
            "Additional public identifying context",
            String(s.custom?.notes || ""),
          ),
        };
      } else if (choice === "5") {
        const depth = await ask(
          "Depth: quick / standard / deep",
          data.research?.depth || "standard",
        );
        if (["quick", "standard", "deep"].includes(depth))
          data.research = { ...data.research, depth: depth as Depth };
        else stderr.write("Unknown depth.\n");
      } else if (choice === "6")
        stderr.write(JSON.stringify(data, null, 2) + "\n");
      else if (choice === "7") {
        try {
          const path = await ask("Save JSON path", "subject.json");
          await atomicJSON(path, validateInput(data));
          stderr.write("Saved " + path + "\n");
        } catch (e) {
          stderr.write((e as Error).message + "\n");
        }
      } else if (choice === "8") {
        try {
          return validateInput(data);
        } catch (e) {
          stderr.write((e as Error).message + "\n");
        }
      }
    }
  } finally {
    rl.close();
  }
}
