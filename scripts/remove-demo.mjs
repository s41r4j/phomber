import { readdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { Workspace } from "../dist/workspace/index.js";
for (const root of [resolve(".phomber"), join(homedir(), ".phomber")]) {
  let removed = 0;
  try {
    for (const id of await readdir(join(root, "reports"))) {
      if (!/^[a-z0-9-]+$/.test(id)) continue;
      const path = join(root, "reports", id);
      let inv;
      try {
        inv = JSON.parse(
          await readFile(join(path, "investigation.json"), "utf8"),
        );
      } catch {
        continue;
      }
      if (
        (inv.input?.subject?.socials || []).some(
          (s) =>
            s.platform === "github" && s.username?.toLowerCase() === "octocat",
        )
      ) {
        await rm(path, { recursive: true });
        removed++;
      }
    }
    await new Workspace(root).updateIndex();
    console.log(`Removed ${removed} Octocat demo(s) from ${root}`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
