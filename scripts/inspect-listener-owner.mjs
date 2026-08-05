#!/usr/bin/env node

import { readdir, readFile, readlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function validateInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (!/^[1-9][0-9]*$/.test(String(value))) {
    throw new Error(`${label} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

async function processSocketInodes(pid) {
  const directory = `/proc/${pid}/fd`;
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return new Set();
    throw error;
  }

  const inodes = new Set();
  await Promise.all(
    entries.map(async (entry) => {
      try {
        const target = await readlink(`${directory}/${entry}`);
        const match = /^socket:\[([0-9]+)\]$/.exec(target);
        if (match) inodes.add(match[1]);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }),
  );
  return inodes;
}

async function listeningInodes(pid, port) {
  const portHex = port.toString(16).toUpperCase().padStart(4, "0");
  const inodes = new Set();
  for (const table of ["tcp", "tcp6"]) {
    let input;
    try {
      input = await readFile(`/proc/${pid}/net/${table}`, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const line of input.trim().split("\n").slice(1)) {
      const fields = line.trim().split(/\s+/);
      const localAddress = fields[1];
      const state = fields[3];
      const inode = fields[9];
      if (
        state === "0A" &&
        localAddress?.toUpperCase().endsWith(`:${portHex}`) &&
        inode
      ) {
        inodes.add(inode);
      }
    }
  }
  return inodes;
}

export async function processOwnsListener(pidValue, portValue) {
  const pid = validateInteger(pidValue, "pid");
  const port = validateInteger(portValue, "port", 65_535);
  const [processInodes, listenerInodes] = await Promise.all([
    processSocketInodes(pid),
    listeningInodes(pid, port),
  ]);
  return [...listenerInodes].some((inode) => processInodes.has(inode));
}

async function main() {
  const [pid, port] = process.argv.slice(2);
  if (!pid || !port) {
    throw new Error("Usage: inspect-listener-owner.mjs <pid> <port>");
  }
  process.stdout.write(
    (await processOwnsListener(pid, port)) ? "owned" : "not-owned",
  );
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
