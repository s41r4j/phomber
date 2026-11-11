import { emitKeypressEvents } from "node:readline";
import { readFile, lstat, chmod, rm } from "node:fs/promises";
import { join } from "node:path";
import { atomicJSON, type Workspace } from "../workspace/index.js";
export function isNpx(): boolean {
  return (
    process.env.npm_command === "exec" || !!process.env.PHOMBER_EPHEMERAL_KEY
  );
}
export async function password(): Promise<string> {
  if (!process.stdin.isTTY)
    throw new Error(
      "DeepSeek key required. Run in a terminal for hidden entry, set DEEPSEEK_API_KEY, or use --no-ai.",
    );
  process.stderr.write("DeepSeek API key (hidden): ");
  const previous = process.stdin.isRaw;
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(previous);
      process.stdin.pause();
      process.stderr.write("\n");
      if (error) reject(error);
      else if (!value.trim()) reject(new Error("API key cannot be empty."));
      else resolve(value.trim());
    };
    const onKey = (
      text: string | undefined,
      key: { name?: string; ctrl?: boolean; meta?: boolean },
    ) => {
      if (key?.ctrl && key.name === "c") {
        finish(new Error("Key entry cancelled."));
        return;
      }
      if (key?.name === "return" || key?.name === "enter") {
        finish();
        return;
      }
      if (key?.name === "backspace") {
        value = [...value].slice(0, -1).join("");
        return;
      }
      if (!key?.ctrl && !key?.meta && text && !/[\x00-\x1f\x7f]/.test(text))
        value += text;
    };
    process.stdin.on("keypress", onKey);
  });
}
export async function readCredential(
  workspace: Workspace,
): Promise<string | undefined> {
  const file = join(workspace.root, "credentials.json");
  try {
    if (!(await lstat(file)).isFile())
      throw new Error("Credential file must be a regular file.");
    const v = JSON.parse(await readFile(file, "utf8")) as { deepseek?: string };
    return typeof v.deepseek === "string" ? v.deepseek : undefined;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}
export async function saveCredential(
  workspace: Workspace,
  key: string,
): Promise<void> {
  await workspace.init();
  const file = join(workspace.root, "credentials.json");
  await atomicJSON(file, { deepseek: key });
  await chmod(file, 0o600);
}
export async function forgetCredential(workspace: Workspace): Promise<void> {
  await rm(join(workspace.root, "credentials.json"), { force: true });
}
export async function getKey(
  workspace: Workspace,
  save = false,
): Promise<string> {
  if (process.env.DEEPSEEK_API_KEY?.trim())
    return process.env.DEEPSEEK_API_KEY.trim();
  const ephemeral = isNpx();
  if (!ephemeral) {
    const saved = await readCredential(workspace);
    if (saved) return saved;
  }
  const key = await password();
  if (!ephemeral || save) await saveCredential(workspace, key);
  return key;
}
