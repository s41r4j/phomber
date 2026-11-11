import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const entry = join(root, 'dist', 'cli', 'index.js');
try { await access(entry); }
catch { console.error('Build PH0MBER first: npm run setup:local'); process.exit(1); }
const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, PHOMBER_HOME: process.env.PHOMBER_HOME || join(root, '.phomber') },
  stdio: 'inherit',
});
const interrupt = () => child.kill('SIGINT');
const terminate = () => child.kill('SIGTERM');
process.on('SIGINT', interrupt);
process.on('SIGTERM', terminate);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', terminate);
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
