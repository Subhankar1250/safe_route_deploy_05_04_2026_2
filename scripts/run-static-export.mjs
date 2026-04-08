/**
 * Next.js output: export cannot include App Router route handlers (app/api route.ts files).
 * Temporarily move app/api aside so npm run build:static (Capacitor out/) succeeds,
 * then restore so npm run build (Vercel) still ships API routes.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apiPath = path.join(root, "app", "api");
// Keep backup outside app/ — Windows often blocks rename into a dot-folder under app/ (EPERM).
const backupPath = path.join(root, ".api_backup_static_export");

function moveApiAside() {
  if (!fs.existsSync(apiPath)) return false;
  fs.rmSync(backupPath, { recursive: true, force: true });
  fs.cpSync(apiPath, backupPath, { recursive: true });
  fs.rmSync(apiPath, { recursive: true, force: true });
  return true;
}

function restoreApi() {
  if (!fs.existsSync(backupPath)) return;
  fs.rmSync(apiPath, { recursive: true, force: true });
  fs.cpSync(backupPath, apiPath, { recursive: true });
  fs.rmSync(backupPath, { recursive: true, force: true });
}

let moved = false;
if (fs.existsSync(apiPath)) {
  moved = moveApiAside();
}

try {
  execSync("cross-env NEXT_STATIC_EXPORT=1 next build", {
    stdio: "inherit",
    cwd: root,
    env: process.env,
    shell: true,
  });
} catch (e) {
  process.exit(e?.status ?? 1);
} finally {
  if (moved) {
    restoreApi();
  }
}
