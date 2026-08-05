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

function selectPortOtherThan(excludedPort: number) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const port = selectIsolatedPort();
    if (port !== excludedPort) return port;
  }
  throw new Error("Could not allocate distinct Playwright server ports.");
}

const appPort = process.env.TRACE_ML_E2E_PORT
  ? parsePort(process.env.TRACE_ML_E2E_PORT)
  : selectIsolatedPort();
const sourcePort = process.env.TRACE_ML_E2E_SOURCE_PORT
  ? parsePort(process.env.TRACE_ML_E2E_SOURCE_PORT)
  : selectPortOtherThan(appPort);
if (sourcePort === appPort) {
  throw new Error("Playwright app and source ports must be different.");
}
process.env.TRACE_ML_E2E_PORT = String(appPort);
process.env.TRACE_ML_E2E_SOURCE_PORT = String(sourcePort);
const appBaseURL = `http://127.0.0.1:${appPort}`;
const sourceBaseURL = `http://127.0.0.1:${sourcePort}`;
const responsiveAppTests =
  /every lesson fits|lesson and helper avoid|storage failure/;
const authoredLabBatchCount = 5;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  maxFailures: 1,
  reporter: "list",
  outputDir: "outputs/playwright",
  projects: [
    {
      name: "production-course",
      testMatch: /app\.e2e\.ts/,
      grepInvert: responsiveAppTests,
      use: { baseURL: appBaseURL },
    },
    {
      name: "production-responsive",
      testMatch: /app\.e2e\.ts/,
      grep: responsiveAppTests,
      use: { baseURL: appBaseURL },
    },
    {
      name: "source-runtime",
      testMatch: /runtime\.e2e\.ts/,
      use: { baseURL: sourceBaseURL },
    },
    ...Array.from({ length: authoredLabBatchCount }, (_, index) => ({
      name: `source-authored-${index + 1}-of-${authoredLabBatchCount}`,
      testMatch: /authored-code\.e2e\.ts/,
      metadata: {
        authoredLabBatchIndex: index,
        authoredLabBatchCount,
      },
      use: { baseURL: sourceBaseURL },
    })),
  ],
  use: {
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        `npm run build && npm run preview -- --host 127.0.0.1 --port ${appPort} --strictPort`,
      url: appBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        `npm exec vite -- --host 127.0.0.1 --port ${sourcePort} --strictPort`,
      url: sourceBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
