#!/usr/bin/env node

import {
  readdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  brotliCompress as brotliCompressCallback,
  constants as zlibConstants,
} from "node:zlib";

const brotliCompress = promisify(brotliCompressCallback);
const COMPRESSIBLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".wasm",
  ".webmanifest",
]);
const MINIMUM_SIZE = 1024;

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function filesBelow(root, directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`build output contains a symbolic link: ${path}`);
      }
      if (entry.isDirectory()) return filesBelow(root, path);
      if (!entry.isFile()) {
        throw new Error(`build output contains a non-file entry: ${path}`);
      }
      const fileReal = await realpath(path);
      if (!isWithin(root, fileReal)) {
        throw new Error(`build output escapes its root: ${path}`);
      }
      return [fileReal];
    }),
  );
  return nested.flat();
}

async function compressFile(path) {
  if (!COMPRESSIBLE_EXTENSIONS.has(extname(path).toLowerCase())) return false;
  const fileStats = await stat(path);
  if (fileStats.size < MINIMUM_SIZE) return false;

  const source = await readFile(path);
  const compressed = await brotliCompress(source, {
    params: {
      [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_GENERIC,
      [zlibConstants.BROTLI_PARAM_QUALITY]: 6,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: source.length,
    },
  });
  if (compressed.length >= source.length) return false;

  const destination = `${path}.br`;
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, compressed, { mode: 0o644 });
  await rename(temporary, destination);
  return true;
}

export async function compressProductionAssets(buildRoot) {
  const root = await realpath(resolve(buildRoot));
  const compressed = (
    await Promise.all((await filesBelow(root, root)).map(compressFile))
  ).filter(Boolean).length;
  return { compressed, root };
}

async function main() {
  if (!process.argv[2]) {
    throw new Error("Usage: compress-production-assets.mjs <build-root>");
  }
  const { compressed, root } = await compressProductionAssets(process.argv[2]);
  process.stdout.write(`Prepared ${compressed} Brotli assets in ${root}\n`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`error: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
