import {
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { brotliDecompressSync } from "node:zlib";
import { compressProductionAssets } from "./compress-production-assets.mjs";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function fixtureDirectory() {
  const root = await mkdtemp(join(tmpdir(), "trace-ml-compress-"));
  cleanups.push(() => rm(root, { force: true, recursive: true }));
  return root;
}

describe("production asset compression", () => {
  test("writes a smaller Brotli sidecar for regular build files", async () => {
    const root = await fixtureDirectory();
    const source = "const fixedCourse = true;\n".repeat(500);
    await writeFile(join(root, "course.js"), source);

    const result = await compressProductionAssets(root);
    const compressed = await readFile(join(root, "course.js.br"));

    expect(result.compressed).toBe(1);
    expect(brotliDecompressSync(compressed).toString()).toBe(source);
  });

  test("rejects symbolic links before reading their targets", async () => {
    const root = await fixtureDirectory();
    const secret = join(root, "..", `trace-ml-secret-${process.pid}.js`);
    cleanups.push(() => rm(secret, { force: true }));
    await writeFile(secret, "private-value\n".repeat(500));
    await symlink(secret, join(root, "leak.js"));

    await expect(compressProductionAssets(root)).rejects.toThrow(
      "build output contains a symbolic link",
    );
    await expect(readFile(join(root, "leak.js.br"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
