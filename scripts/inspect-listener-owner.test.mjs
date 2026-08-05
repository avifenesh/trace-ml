import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { afterEach, describe, expect, test } from "vitest";
import { processOwnsListener } from "./inspect-listener-owner.mjs";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  cleanups.push(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind a TCP port.");
  }
  return address.port;
}

async function childListener() {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      [
        'import { createServer } from "node:net";',
        "const server = createServer();",
        'server.listen(0, "127.0.0.1", () => {',
        "  const address = server.address();",
        '  if (!address || typeof address === "string") process.exit(1);',
        "  console.log(address.port);",
        "});",
        "setInterval(() => {}, 1000);",
      ].join("\n"),
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  let output = "";
  const port = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      reject(new Error(`Listener child exited before reporting a port: ${code}`));
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = /^([0-9]+)\n/.exec(output);
      if (match) resolve(Number(match[1]));
    });
  });
  cleanups.push(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    if (child.exitCode === null && child.signalCode === null) {
      await once(child, "exit");
    }
  });
  return { child, port };
}

describe.runIf(process.platform === "linux")("listener ownership", () => {
  test("distinguishes the listener process from an incumbent process", async () => {
    const ownPort = await listen(createServer());
    const { child, port: childPort } = await childListener();

    await expect(processOwnsListener(process.pid, ownPort)).resolves.toBe(true);
    await expect(processOwnsListener(process.pid, childPort)).resolves.toBe(
      false,
    );
    await expect(processOwnsListener(child.pid, childPort)).resolves.toBe(true);
  });
});
