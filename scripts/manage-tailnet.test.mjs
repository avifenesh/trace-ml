import { spawn } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const manageScript = fileURLToPath(
  new URL("./manage-tailnet.sh", import.meta.url),
);
const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const toolShim = String.raw`#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const command = basename(process.argv[1]);
const args = process.argv.slice(2);
const stateDirectory = process.env.TRACE_ML_TEST_STATE;
const systemctlPath = join(stateDirectory, "systemctl.json");
const routesPath = join(stateDirectory, "routes.json");
const unitPath = join(
  process.env.XDG_CONFIG_HOME,
  "systemd/user/trace-ml-web.service",
);

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function writeJson(path, value) {
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopService(state) {
  if (processExists(state.pid)) {
    process.kill(state.pid, "SIGTERM");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (!processExists(state.pid)) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (processExists(state.pid)) process.kill(state.pid, "SIGKILL");
  }
  state.active = false;
  state.pid = 0;
}

function parseUnit() {
  const unit = readFileSync(unitPath, "utf8");
  const workingDirectory =
    /^WorkingDirectory=(.+)$/m.exec(unit)?.[1]
      .replaceAll("\\x20", " ")
      .replaceAll("\\x09", "\t")
      .replaceAll("\\x5c", "\\")
      .replaceAll("%%", "%");
  const execStart = /^ExecStart=(.+)$/m.exec(unit)?.[1];
  const match = execStart?.match(
    /^"([^"]+)" "([^"]+)" --host ([^ ]+) --port ([^ ]+) --root "([^"]+)"$/,
  );
  if (!workingDirectory || !match) {
    throw new Error("Could not parse fixture systemd unit.");
  }
  return {
    command: match[1].replaceAll("%%", "%"),
    arguments: [
      match[2].replaceAll("%%", "%"),
      "--host",
      match[3],
      "--port",
      match[4],
      "--root",
      match[5].replaceAll("%%", "%"),
    ],
    workingDirectory,
  };
}

async function startService(state) {
  await stopService(state);
  const unit = parseUnit();
  const log = openSync(join(stateDirectory, "service.log"), "a");
  const child = spawn(unit.command, unit.arguments, {
    cwd: unit.workingDirectory,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  state.active = true;
  state.pid = child.pid;
  state.workingDirectory = unit.workingDirectory;
}

async function runSystemctl() {
  const commandArgs = args.filter((argument) => argument !== "--user");
  const operation = commandArgs[0];
  const state = readJson(systemctlPath, {
    active: false,
    enabled: false,
    pid: 0,
    workingDirectory: "",
  });
  if (state.active && !processExists(state.pid)) {
    state.active = false;
    state.pid = 0;
  }

  if (operation === "is-active") {
    process.exit(state.active ? 0 : 3);
  }
  if (operation === "is-enabled") {
    process.exit(state.enabled ? 0 : 1);
  }
  if (operation === "show") {
    const property = commandArgs.find((argument) =>
      argument.startsWith("--property="),
    )?.slice("--property=".length);
    if (property === "WorkingDirectory") {
      process.stdout.write(state.workingDirectory + "\n");
    } else if (property === "MainPID") {
      process.stdout.write(String(state.pid) + "\n");
    }
    return;
  }
  if (operation === "enable") {
    state.enabled = true;
    if (process.env.TRACE_ML_TEST_FAIL_SYSTEMCTL_ENABLE === "1") {
      writeJson(systemctlPath, state);
      process.exit(1);
    }
    if (commandArgs.includes("--now")) await startService(state);
  } else if (operation === "start") {
    await startService(state);
  } else if (operation === "disable") {
    state.enabled = false;
    if (process.env.TRACE_ML_TEST_FAIL_SYSTEMCTL_DISABLE === "1") {
      writeJson(systemctlPath, state);
      process.exit(1);
    }
    if (commandArgs.includes("--now")) await stopService(state);
  } else if (operation === "restart") {
    await startService(state);
  } else if (operation === "stop") {
    await stopService(state);
  } else if (operation === "status") {
    process.stdout.write(
      "fixture service " + (state.active ? "active" : "inactive") + "\n",
    );
  } else if (
    operation !== "daemon-reload" &&
    operation !== "reset-failed"
  ) {
    throw new Error("Unsupported fixture systemctl operation: " + operation);
  }
  writeJson(systemctlPath, state);
}

function serveStatus(routes) {
  const config = { TCP: {}, Web: {} };
  for (const [port, target] of Object.entries(routes)) {
    config.TCP[port] = { HTTPS: true };
    config.Web["trace.tail0000.ts.net:" + port] = {
      Handlers: { "/": { Proxy: target } },
    };
  }
  return config;
}

function runTailscale() {
  if (args[0] === "status" && args[1] === "--json") {
    process.stdout.write(
      JSON.stringify({ Self: { DNSName: "trace.tail0000.ts.net." } }),
    );
    return;
  }
  if (args[0] !== "serve") {
    throw new Error(
      "Unsupported fixture tailscale command: " + args.join(" "),
    );
  }

  const routes = readJson(routesPath, {});
  if (args[1] === "status" && args[2] === "--json") {
    process.stdout.write(JSON.stringify(serveStatus(routes)));
    return;
  }
  const port = args
    .find((argument) => argument.startsWith("--https="))
    ?.slice("--https=".length);
  if (!port) throw new Error("Fixture Serve command is missing an HTTPS port.");

  if (args.at(-1) === "off") {
    if (process.env.TRACE_ML_TEST_FAIL_ROUTE_OFF === "1") process.exit(1);
    delete routes[port];
  } else {
    if (process.env.TRACE_ML_TEST_FAIL_ROUTE_CONFIGURE === "1") process.exit(1);
    routes[port] = args.at(-1);
  }
  writeJson(routesPath, routes);
}

function runNpm() {
  if (args[0] === "ci") return;
  if (args[0] === "run" && args[1] === "build") {
    const outputIndex = args.indexOf("--outDir");
    const output = args[outputIndex + 1];
    if (outputIndex < 0 || !output) {
      throw new Error("Fixture build is missing --outDir.");
    }
    mkdirSync(output, { recursive: true });
    writeFileSync(
      join(output, "index.html"),
      "<main>Trace ML fixture release</main>\n".repeat(100),
    );
    return;
  }
  throw new Error("Unsupported fixture npm command: " + args.join(" "));
}

try {
  if (command === "systemctl") {
    await runSystemctl();
  } else if (command === "tailscale") {
    runTailscale();
  } else if (command === "npm") {
    runNpm();
  } else if (command === "loginctl") {
    process.stdout.write("yes\n");
  } else if (command !== "systemd-analyze") {
    throw new Error("Unsupported fixture tool: " + command);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
`;

async function selectFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not select a fixture TCP port.");
  }
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "trace-ml-tailnet-"));
  const bin = join(root, "bin");
  const state = join(root, "state");
  const runtime = join(root, "runtime");
  const config = join(root, "config");
  const data = join(root, "data");
  await Promise.all([
    mkdir(bin, { recursive: true }),
    mkdir(state, { recursive: true }),
    mkdir(runtime, { recursive: true }),
  ]);

  const shimPath = join(bin, "tool-shim.mjs");
  await writeFile(shimPath, toolShim);
  await chmod(shimPath, 0o755);
  await Promise.all(
    ["loginctl", "npm", "systemctl", "systemd-analyze", "tailscale"].map(
      (command) => symlink("tool-shim.mjs", join(bin, command)),
    ),
  );

  const [localPort, httpsPort] = await Promise.all([
    selectFreePort(),
    selectFreePort(),
  ]);
  const environment = {
    ...process.env,
    HOME: root,
    PATH: `${bin}:${process.env.PATH}`,
    TRACE_ML_TAILNET_HTTPS_PORT: String(httpsPort),
    TRACE_ML_TEST_STATE: state,
    TRACE_ML_WEB_PORT: String(localPort),
    XDG_CONFIG_HOME: config,
    XDG_DATA_HOME: data,
    XDG_RUNTIME_DIR: runtime,
  };
  delete environment.DBUS_SESSION_BUS_ADDRESS;

  async function stopFixtureService() {
    try {
      const systemctl = JSON.parse(
        await readFile(join(state, "systemctl.json"), "utf8"),
      );
      if (systemctl.pid > 0) process.kill(systemctl.pid, "SIGKILL");
    } catch {
      // The fixture may not have started a service.
    }
  }

  cleanups.push(async () => {
    await stopFixtureService();
    await rm(root, { force: true, recursive: true });
  });

  return {
    config,
    data,
    environment,
    httpsPort,
    localPort,
    root,
    state,
  };
}

function runLifecycle(action, environment, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [manageScript, action], {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Lifecycle command timed out: ${action}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({
        code,
        signal,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      });
    });
  });
}

async function readFixtureJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("managed tailnet lifecycle", () => {
  test(
    "installs, probes, stops, restores, and uninstalls the real server process",
    async () => {
      const fixture = await createFixture();
      const install = await runLifecycle("install", fixture.environment);
      const serviceLog = await readFile(
        join(fixture.state, "service.log"),
        "utf8",
      ).catch(() => "");
      expect(install.code, `${install.stderr}\n${serviceLog}`).toBe(0);
      expect(install.signal).toBeNull();
      expect(install.stdout).toContain(
        `https://trace.tail0000.ts.net:${fixture.httpsPort}/`,
      );

      const status = await runLifecycle("status", fixture.environment);
      expect(status.code).toBe(0);
      expect(status.stdout).toContain(
        '{"service":"trace-ml","status":"ok"}',
      );
      expect(status.stdout).toMatch(/Main PID: [1-9][0-9]*/);

      const stop = await runLifecycle("stop", fixture.environment);
      expect(stop.code).toBe(0);
      expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual(
        {},
      );

      const failedEnable = await runLifecycle("start", {
        ...fixture.environment,
        TRACE_ML_TEST_FAIL_SYSTEMCTL_ENABLE: "1",
      });
      expect(failedEnable.code).toBe(1);
      expect(
        await readFixtureJson(join(fixture.state, "systemctl.json")),
      ).toMatchObject({ active: false, enabled: false });

      const failedStart = await runLifecycle("start", {
        ...fixture.environment,
        TRACE_ML_TEST_FAIL_ROUTE_CONFIGURE: "1",
      });
      expect(failedStart.code).toBe(1);
      expect(
        await readFixtureJson(join(fixture.state, "systemctl.json")),
      ).toMatchObject({ active: false, enabled: false });

      const start = await runLifecycle("start", fixture.environment);
      expect(start.code, start.stderr).toBe(0);
      expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual(
        {
          [fixture.httpsPort]: `http://127.0.0.1:${fixture.localPort}`,
        },
      );

      const failedStop = await runLifecycle("stop", {
        ...fixture.environment,
        TRACE_ML_TEST_FAIL_SYSTEMCTL_DISABLE: "1",
      });
      expect(failedStop.code).toBe(1);
      expect(
        await readFixtureJson(join(fixture.state, "systemctl.json")),
      ).toMatchObject({ active: true, enabled: true });
      expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual(
        {
          [fixture.httpsPort]: `http://127.0.0.1:${fixture.localPort}`,
        },
      );

      const uninstall = await runLifecycle("uninstall", fixture.environment);
      expect(uninstall.code).toBe(0);
      await expect(
        readFile(join(fixture.config, "trace-ml/tailnet.conf"), "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await expect(
        readdir(join(fixture.data, "trace-ml-web/releases")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
    30_000,
  );

  test(
    "rejects port migration and rolls back a failed release cutover",
    async () => {
      const fixture = await createFixture();
      const install = await runLifecycle("install", fixture.environment);
      expect(install.code, install.stderr).toBe(0);
      const originalState = await readFixtureJson(
        join(fixture.state, "systemctl.json"),
      );
      const originalReleases = await readdir(
        join(fixture.data, "trace-ml-web/releases"),
      );

      const migration = await runLifecycle("install", {
        ...fixture.environment,
        TRACE_ML_WEB_PORT: String(fixture.localPort + 1),
      });
      expect(migration.code).toBe(1);
      expect(migration.stderr).toContain(
        "uninstall before reinstalling with different ports",
      );

      const failedRestart = await runLifecycle("restart", {
        ...fixture.environment,
        TRACE_ML_TEST_FAIL_ROUTE_CONFIGURE: "1",
      });
      expect(failedRestart.code).toBe(1);
      const restoredState = await readFixtureJson(
        join(fixture.state, "systemctl.json"),
      );
      expect(restoredState).toMatchObject({
        active: true,
        enabled: true,
        workingDirectory: originalState.workingDirectory,
      });
      expect(
        await readdir(join(fixture.data, "trace-ml-web/releases")),
      ).toEqual(originalReleases);
      expect((await runLifecycle("status", fixture.environment)).code).toBe(0);
    },
    30_000,
  );

  test(
    "retains cleanup metadata when uninstall cannot remove the route",
    async () => {
      const fixture = await createFixture();
      const install = await runLifecycle("install", fixture.environment);
      expect(install.code, install.stderr).toBe(0);

      const partial = await runLifecycle("uninstall", {
        ...fixture.environment,
        TRACE_ML_TEST_FAIL_ROUTE_OFF: "1",
      });
      expect(partial.code).toBe(1);
      expect(partial.stderr).toContain("make tailnet-uninstall");
      expect(partial.stderr).not.toContain(
        `tailscale serve --yes --https=${fixture.httpsPort} off`,
      );
      expect(
        await readFile(
          join(fixture.config, "trace-ml/tailnet.conf"),
          "utf8",
        ),
      ).toContain(
        `TRACE_ML_TAILNET_HTTPS_PORT=${fixture.httpsPort}`,
      );

      const cleanup = await runLifecycle("uninstall", fixture.environment);
      expect(cleanup.code).toBe(0);
      await expect(
        readFile(join(fixture.config, "trace-ml/tailnet.conf"), "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
    30_000,
  );

  test(
    "refuses unrelated units and routes without destructive cleanup",
    async () => {
      const unrelatedUnitFixture = await createFixture();
      const unrelatedUnit = join(
        unrelatedUnitFixture.config,
        "systemd/user/trace-ml-web.service",
      );
      await mkdir(join(unrelatedUnitFixture.config, "systemd/user"), {
        recursive: true,
      });
      await writeFile(
        unrelatedUnit,
        "[Unit]\nDescription=Unrelated local service\n",
      );
      const refusedInstall = await runLifecycle(
        "install",
        unrelatedUnitFixture.environment,
      );
      expect(refusedInstall.code).toBe(1);
      expect(refusedInstall.stderr).toContain(
        "exists without Trace ML ownership metadata",
      );
      expect(await readFile(unrelatedUnit, "utf8")).toContain(
        "Unrelated local service",
      );

      const routeFixture = await createFixture();
      const install = await runLifecycle("install", routeFixture.environment);
      expect(install.code, install.stderr).toBe(0);
      const unrelatedTarget = "http://127.0.0.1:65535";
      await writeFile(
        join(routeFixture.state, "routes.json"),
        JSON.stringify({
          [routeFixture.httpsPort]: unrelatedTarget,
        }),
      );

      const refusedCleanup = await runLifecycle(
        "uninstall",
        routeFixture.environment,
      );
      expect(refusedCleanup.code).toBe(1);
      expect(refusedCleanup.stderr).toContain(
        "Do not remove the port-wide route",
      );
      expect(refusedCleanup.stderr).not.toContain(
        `tailscale serve --yes --https=${routeFixture.httpsPort} off`,
      );
      expect(
        await readFixtureJson(join(routeFixture.state, "routes.json")),
      ).toEqual({ [routeFixture.httpsPort]: unrelatedTarget });
      expect(
        await readFile(
          join(routeFixture.config, "trace-ml/tailnet.conf"),
          "utf8",
        ),
      ).toContain(
        `TRACE_ML_TAILNET_HTTPS_PORT=${routeFixture.httpsPort}`,
      );
    },
    30_000,
  );
});
