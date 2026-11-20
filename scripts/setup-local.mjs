import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Workspace, atomicJSON } from "../dist/workspace/index.js";
import { readLibrary } from "../dist/reports/library.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const workspace = new Workspace();
await workspace.init();
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
const catalog = join(root, "references", "library.json");
if (
  !(await exists(join(workspace.root, "library.json"))) &&
  (await exists(catalog))
) {
  const library = await readLibrary(catalog);
  await atomicJSON(join(workspace.root, "library.json"), library);
  console.log(`Imported ${library.articles.length} archived wiki pages.`);
} else console.log("Preserved existing local library.");
console.log(
  `\nShared workspace: ${workspace.root}\nStart the wiki: npm run dev\nStart research: npm run local -- find\nCheck local NPX: npx --no-install phomber help\nInstalled, NPX and checkout commands use this workspace. Set PHOMBER_HOME to an absolute path for an isolated workspace. Research prompts privately for a DeepSeek key; --no-ai runs adapters only.`,
);
