import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";

function parsePort(value: string) {
  if (!/^[0-9]{1,5}$/.test(value)) {
    throw new Error(`Invalid TRACE_ML_E2E_PORT: ${value}`);
  }
  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid TRACE_ML_E2E_PORT: ${value}`);
  }
  return port;
}

function selectIsolatedPort() {
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      [
        'import { createServer } from "node:net";',
        "const server = createServer();",
        'await new Promise((resolve, reject) => {',
        '  server.once("error", reject);',
        '  server.listen(0, "127.0.0.1", resolve);',
        "});",
        "const address = server.address();",
        'if (!address || typeof address === "string") process.exit(1);',
        "console.log(address.port);",
        "await new Promise((resolve, reject) =>",
        '  server.close((error) => error ? reject(error) : resolve()),',
        ");",
      ].join("\n"),
    ],
    { encoding: "utf8" },
  ).trim();
  return parsePort(output);
}

const port = process.env.TRACE_ML_E2E_PORT
  ? parsePort(process.env.TRACE_ML_E2E_PORT)
  : selectIsolatedPort();
process.env.TRACE_ML_E2E_PORT = String(port);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "outputs/playwright",
  use: {
    baseURL,
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
