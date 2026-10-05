import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

test("metadata CLI rejects Pyodide and Tauri drift in a real repository snapshot", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "trace-ml-metadata-"));
  try {
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: sourceRoot, encoding: "utf8" });
    for (const relativePath of tracked.split("\0").filter(Boolean)) {
      const destination = join(fixture, relativePath);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(sourceRoot, relativePath), destination);
    }
    await symlink(join(sourceRoot, "node_modules"), join(fixture, "node_modules"), "dir");
    execFileSync("git", ["init", "--quiet"], { cwd: fixture });
    execFileSync("git", ["add", "."], { cwd: fixture });
    const run = () => spawnSync(process.execPath, ["scripts/check-repository-metadata.mjs"], {
      cwd: fixture, encoding: "utf8", timeout: 10_000,
      env: { ...process.env, TRACE_ML_REQUIRE_RELEASE_TAG: "0" },
    });
    expect(run().status).toBe(0);

    const runtimePath = join(fixture, "e2e/runtime.e2e.ts");
    const runtime = await readFile(runtimePath, "utf8");
    await writeFile(runtimePath, runtime.replace(/pyodideVersion: "[^"]+"/, 'pyodideVersion: "0.0.0"'));
    const staleRuntime = run();
    expect(staleRuntime.status).toBe(1);
    expect(staleRuntime.stderr).toContain("e2e/runtime.e2e.ts Pyodide runtime");
    await writeFile(runtimePath, runtime);

    const lockPath = join(fixture, "package-lock.json");
    const lockText = await readFile(lockPath, "utf8");
    for (const packageName of ["@tauri-apps/api", "@tauri-apps/plugin-opener"]) {
      const lock = JSON.parse(lockText);
      lock.packages[`node_modules/${packageName}`].version = "0.0.0";
      await writeFile(lockPath, JSON.stringify(lock));
      const mismatch = run();
      expect(mismatch.status).toBe(1);
      expect(mismatch.stderr).toContain(`${packageName} major.minor`);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30_000);
