import { spawn } from "node:child_process";
import {
  chmod,
  copyFile,
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
const productionServerScript = fileURLToPath(
  new URL("./serve-production.mjs", import.meta.url),
);
const routeInspectorScript = fileURLToPath(
  new URL("./inspect-tailnet-route.mjs", import.meta.url),
);
const cleanups = [];
const describeLinux = process.platform === "linux" ? describe : describe.skip;

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const toolShim = String.raw`#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const commandPath = process.argv[1];
const command = basename(commandPath);
let args = process.argv.slice(2);
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
  const bridgeMatch = execStart?.match(
    /^"([^"]+)" "([^"]+)" --host ([^ ]+) --port ([^ ]+) --root "([^"]+)" --bedrock-bridge "([^"]+)" --tailscale-command "([^"]+)"(?: --tailscale-socket "([^"]+)")? --tailnet-https-port ([^ ]+)$/,
  );
  const legacyMatch = execStart?.match(
    /^"([^"]+)" "([^"]+)" --host ([^ ]+) --port ([^ ]+) --root "([^"]+)"$/,
  );
  const match = bridgeMatch ?? legacyMatch;
  if (!workingDirectory || !match) {
    throw new Error("Could not parse fixture systemd unit.");
  }
  const arguments_ = [
    match[2].replaceAll("%%", "%"),
    "--host",
    match[3],
    "--port",
    match[4],
    "--root",
    match[5].replaceAll("%%", "%"),
  ];
  if (bridgeMatch) {
    arguments_.push(
      "--bedrock-bridge",
      bridgeMatch[6].replaceAll("%%", "%"),
      "--tailscale-command",
      bridgeMatch[7].replaceAll("%%", "%"),
    );
    if (bridgeMatch[8]) {
      arguments_.push(
        "--tailscale-socket",
        bridgeMatch[8].replaceAll("%%", "%"),
      );
    }
    arguments_.push("--tailnet-https-port", bridgeMatch[9]);
  }
  return {
    command: match[1].replaceAll("%%", "%"),
    arguments: arguments_,
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
    env: { ...process.env, TRACE_ML_TEST_SERVICE_PROCESS: "1" },
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
      process.stdout.write(parseUnit().workingDirectory + "\n");
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
      if (process.env.TRACE_ML_TEST_ROUTE_ON_DISABLE_FAILURE) {
        const routes = readJson(routesPath, {});
        const port = process.env.TRACE_ML_TAILNET_HTTPS_PORT;
        routes[port] = process.env.TRACE_ML_TEST_ROUTE_ON_DISABLE_FAILURE;
        writeJson(routesPath, routes);
      }
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
  if (process.env.TRACE_ML_TEST_FUNNEL_TARGET) {
    const endpoint = "trace.tail0000.ts.net:8443";
    config.AllowFunnel = { [endpoint]: true };
    config.TCP[8443] = { HTTPS: true };
    config.Web[endpoint] = {
      Handlers: { "/": { Proxy: process.env.TRACE_ML_TEST_FUNNEL_TARGET } },
    };
  }
  return config;
}

function runTailscale() {
  const snapCommand = process.env.TRACE_ML_TEST_SNAP_COMMAND;
  const snapSocket = process.env.TRACE_ML_TEST_SNAP_SOCKET;
  const isSnapDirectClient = Boolean(
    snapCommand && commandPath === snapCommand,
  );
  if (isSnapDirectClient) {
    if (args[0] !== "--socket" || args[1] !== snapSocket) {
      throw new Error(
        "Fixture direct Tailscale client requires the exact Snap socket.",
      );
    }
    args = args.slice(2);
  } else if (args[0] === "--socket") {
    throw new Error("Fixture Tailscale launcher does not accept --socket.");
  }
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
    if (
      isSnapDirectClient &&
      process.env.TRACE_ML_TEST_FAIL_SNAP_STATUS === "1"
    ) {
      process.exit(1);
    }
    if (
      process.env.TRACE_ML_TEST_FAIL_POST_CUTOVER_GUARD === "1" &&
      process.env.TRACE_ML_TEST_SERVICE_PROCESS === "1"
    ) {
      const marker = join(stateDirectory, "post-cutover-guard-failed");
      try {
        openSync(marker, "wx");
        process.exit(1);
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
    }
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

function runSnap() {
  if (
    args[0] !== "run" ||
    args[1] !== "--shell" ||
    args[2] !== "tailscale" ||
    args[3] !== "-c" ||
    !args[4]
  ) {
    throw new Error("Unsupported fixture snap command: " + args.join(" "));
  }
  process.stdout.write(
    process.env.TRACE_ML_TEST_SNAP_MOUNT +
      "\n" +
      process.env.TRACE_ML_TEST_SNAP_COMMON +
      "\n",
  );
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

function runCargo() {
  const targetIndex = args.indexOf("--target-dir");
  const target = args[targetIndex + 1];
  if (targetIndex < 0 || !target) {
    throw new Error("Fixture cargo build is missing --target-dir.");
  }
  const output = join(target, "release", "trace-ml-bedrock-bridge");
  mkdirSync(join(target, "release"), { recursive: true });
  writeFileSync(
    output,
    [
      "#!/usr/bin/env node",
      'import { appendFileSync } from "node:fs";',
      'import { join } from "node:path";',
      'import { createInterface } from "node:readline";',
      "appendFileSync(",
      '  join(process.env.TRACE_ML_TEST_STATE, "bridge-pids.log"),',
      '  String(process.pid) + "\\n",',
      ");",
      "const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });",
      'lines.on("line", (line) => {',
      "  const request = JSON.parse(line);",
      "  let result;",
      '  if (request.action === "ping") {',
      '    result = { service: "trace-ml-bedrock-bridge", status: "ok" };',
      '} else if (request.action.endsWith("Ready")) {',
      "    result = {",
      "      available: true,",
      '      model: "openai.gpt-5.6-sol",',
      '      retentionMode: "provider_data_share",',
      '      retentionSource: "account",',
      '      allowedRetentionModes: ["default", "provider_data_share"],',
      "    };",
      '} else if (request.action.startsWith("cancel")) {',
      "    result = true;",
      "} else {",
      '    result = { status: "boundary", text: "Boundary.", claims: [] };',
      "  }",
      "  process.stdout.write(JSON.stringify({",
      "    id: request.id, ok: true, result,",
      '  }) + "\\n");',
      "});",
      "",
    ].join("\n"),
  );
  chmodSync(output, 0o755);
}

try {
  if (command === "systemctl") {
    await runSystemctl();
  } else if (command === "tailscale") {
    runTailscale();
  } else if (command === "snap") {
    runSnap();
  } else if (command === "npm") {
    runNpm();
  } else if (command === "cargo") {
    runCargo();
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

async function createFixture({
  snapDirectClient = true,
  snapSocketAvailable = true,
  snapTailscale = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "trace-ml-tailnet-"));
  const bin = join(root, "bin");
  const state = join(root, "state");
  const runtime = join(root, "runtime");
  const config = join(root, "config");
  const data = join(root, "data");
  const snapBin = join(root, "snap/bin");
  const snapMount = join(root, "snap/tailscale/154");
  const snapCurrentBin = join(root, "snap/tailscale/current/bin");
  const snapCommon = join(root, "var/snap/tailscale/common");
  const snapSocket = join(snapCommon, "socket/tailscaled.sock");
  let snapSocketServer = null;
  await Promise.all([
    mkdir(bin, { recursive: true }),
    mkdir(state, { recursive: true }),
    mkdir(runtime, { recursive: true }),
  ]);

  const shimPath = join(bin, "tool-shim.mjs");
  await writeFile(shimPath, toolShim);
  await chmod(shimPath, 0o755);
  await Promise.all(
    [
      "cargo",
      "loginctl",
      "npm",
      "systemctl",
      "systemd-analyze",
      "tailscale",
    ].map((command) => symlink("tool-shim.mjs", join(bin, command))),
  );
  if (snapTailscale) {
    await Promise.all([
      mkdir(snapBin, { recursive: true }),
      mkdir(snapCurrentBin, { recursive: true }),
      mkdir(join(snapCommon, "socket"), { recursive: true }),
    ]);
    const snapLinks = [
      symlink(shimPath, join(bin, "snap")),
      symlink(shimPath, join(snapBin, "tailscale")),
    ];
    if (snapDirectClient) {
      snapLinks.push(
        symlink(shimPath, join(snapCurrentBin, "tailscale")),
      );
    }
    await Promise.all(snapLinks);
    if (snapSocketAvailable) {
      snapSocketServer = createServer();
      await new Promise((resolve, reject) => {
        snapSocketServer.once("error", reject);
        snapSocketServer.listen(snapSocket, resolve);
      });
    }
  }

  const [localPort, httpsPort] = await Promise.all([
    selectFreePort(),
    selectFreePort(),
  ]);
  const environment = {
    ...process.env,
    HOME: root,
    PATH: `${snapTailscale ? `${snapBin}:` : ""}${bin}:${process.env.PATH}`,
    TRACE_ML_CARGO_TARGET_DIR: join(root, "cargo-target"),
    TRACE_ML_TAILNET_HTTPS_PORT: String(httpsPort),
    TRACE_ML_TEST_STATE: state,
    TRACE_ML_WEB_PORT: String(localPort),
    XDG_CONFIG_HOME: config,
    XDG_DATA_HOME: data,
    XDG_RUNTIME_DIR: runtime,
  };
  if (snapTailscale) {
    environment.TRACE_ML_TEST_SNAP_COMMON = snapCommon;
    environment.TRACE_ML_TEST_SNAP_COMMAND = join(
      root,
      "snap/tailscale/current/bin/tailscale",
    );
    environment.TRACE_ML_TEST_SNAP_MOUNT = snapMount;
    environment.TRACE_ML_TEST_SNAP_SOCKET = snapSocket;
  }
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
    if (snapSocketServer) {
      await new Promise((resolve) => snapSocketServer.close(resolve));
    }
    await rm(root, { force: true, recursive: true });
  });

  return {
    config,
    data,
    environment,
    httpsPort,
    localPort,
    root,
    snapCommand: snapTailscale
      ? join(root, "snap/tailscale/current/bin/tailscale")
      : null,
    snapSocket: snapTailscale ? snapSocket : null,
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

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function bridgePids(fixture) {
  const contents = await readFile(
    join(fixture.state, "bridge-pids.log"),
    "utf8",
  ).catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  return contents
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(Number)
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function liveBridgePids(fixture) {
  return (await bridgePids(fixture)).filter(processExists);
}

async function seedLegacyInstallation(fixture) {
  const release = join(
    fixture.data,
    "trace-ml-web/releases/legacy-release",
  );
  const unitDirectory = join(fixture.config, "systemd/user");
  const unitPath = join(unitDirectory, "trace-ml-web.service");
  const configDirectory = join(fixture.config, "trace-ml");
  await Promise.all([
    mkdir(join(release, "dist"), { recursive: true }),
    mkdir(join(release, "scripts"), { recursive: true }),
    mkdir(unitDirectory, { recursive: true }),
    mkdir(configDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      join(release, "dist/index.html"),
      "<main>Legacy Trace ML release</main>",
    ),
    copyFile(
      productionServerScript,
      join(release, "scripts/serve-production.mjs"),
    ),
    copyFile(
      routeInspectorScript,
      join(release, "scripts/inspect-tailnet-route.mjs"),
    ),
    writeFile(
      join(configDirectory, "tailnet.conf"),
      `TRACE_ML_WEB_PORT=${fixture.localPort}\n` +
        `TRACE_ML_TAILNET_HTTPS_PORT=${fixture.httpsPort}\n`,
    ),
  ]);
  await writeFile(
    unitPath,
    [
      "# Managed by Trace ML",
      "[Unit]",
      "Description=Trace ML tailnet web course",
      "",
      "[Service]",
      "Type=simple",
      `WorkingDirectory=${release}`,
      `ExecStart="${process.execPath}" ` +
        `"${join(release, "scripts/serve-production.mjs")}" ` +
        `--host 127.0.0.1 --port ${fixture.localPort} ` +
        `--root "${join(release, "dist")}"`,
      "Restart=on-failure",
      "",
      "[Install]",
      "WantedBy=default.target",
      "",
    ].join("\n"),
  );
  return release;
}

describeLinux("managed tailnet lifecycle", () => {
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
      await expect.poll(() => liveBridgePids(fixture)).toHaveLength(1);

      const status = await runLifecycle("status", fixture.environment);
      expect(status.code).toBe(0);
      expect(status.stdout).toContain(
        '{"service":"trace-ml","status":"ok"}',
      );
      expect(status.stdout).toMatch(/Main PID: [1-9][0-9]*/);
      expect(status.stdout).toContain(
        "Bedrock: available (openai.gpt-5.6-sol",
      );

      const stop = await runLifecycle("stop", fixture.environment);
      expect(stop.code).toBe(0);
      await expect.poll(() => liveBridgePids(fixture)).toEqual([]);
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
      await expect.poll(() => liveBridgePids(fixture)).toEqual([]);

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
      await expect.poll(() => liveBridgePids(fixture)).toHaveLength(1);
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
      await expect.poll(() => liveBridgePids(fixture)).toHaveLength(1);
      expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual(
        {
          [fixture.httpsPort]: `http://127.0.0.1:${fixture.localPort}`,
        },
      );

      const uninstall = await runLifecycle("uninstall", fixture.environment);
      expect(uninstall.code).toBe(0);
      await expect.poll(() => liveBridgePids(fixture)).toEqual([]);
      await expect(
        readFile(join(fixture.config, "trace-ml/tailnet.conf"), "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" });
      await expect(
        readdir(join(fixture.data, "trace-ml-web/releases")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    },
    30_000,
  );

  test("uses the direct Snap client without weakening the service sandbox", async () => {
    const fixture = await createFixture({ snapTailscale: true });
    const install = await runLifecycle("install", fixture.environment);
    expect(install.code, install.stderr).toBe(0);

    const unit = await readFile(
      join(fixture.config, "systemd/user/trace-ml-web.service"),
      "utf8",
    );
    expect(unit).toContain(
      `--tailscale-command "${fixture.snapCommand}" ` +
        `--tailscale-socket "${fixture.snapSocket}"`,
    );
    expect(unit).toContain("NoNewPrivileges=yes");
    expect(
      (await runLifecycle("status", fixture.environment)).stdout,
    ).toContain("Bedrock: available (openai.gpt-5.6-sol");
  }, 30_000);

  test("rejects incomplete or unusable Snap runtime details", async () => {
    const malformed = await createFixture({ snapTailscale: true });
    const malformedInstall = await runLifecycle("install", {
      ...malformed.environment,
      TRACE_ML_TEST_SNAP_MOUNT: "snap/tailscale/154",
    });
    expect(malformedInstall.code).toBe(1);
    expect(malformedInstall.stderr).toContain(
      "Tailscale Snap returned invalid runtime paths",
    );

    const missingClient = await createFixture({
      snapDirectClient: false,
      snapTailscale: true,
    });
    const missingClientInstall = await runLifecycle(
      "install",
      missingClient.environment,
    );
    expect(missingClientInstall.code).toBe(1);
    expect(missingClientInstall.stderr).toContain(
      "Tailscale Snap client is unavailable",
    );

    const missingSocket = await createFixture({
      snapSocketAvailable: false,
      snapTailscale: true,
    });
    const missingSocketInstall = await runLifecycle(
      "install",
      missingSocket.environment,
    );
    expect(missingSocketInstall.code).toBe(1);
    expect(missingSocketInstall.stderr).toContain(
      "Tailscale Snap socket is unavailable",
    );

    const failedStatus = await createFixture({ snapTailscale: true });
    const failedStatusInstall = await runLifecycle("install", {
      ...failedStatus.environment,
      TRACE_ML_TEST_FAIL_SNAP_STATUS: "1",
    });
    expect(failedStatusInstall.code).toBe(1);
    expect(failedStatusInstall.stderr).toContain(
      "Tailscale Snap client cannot read Serve status directly",
    );
  }, 30_000);

  test(
    "upgrades a running legacy release to the bridge-enabled service",
    async () => {
      const fixture = await createFixture();
      const legacyRelease = await seedLegacyInstallation(fixture);
      const legacyStart = await runLifecycle("start", fixture.environment);
      expect(legacyStart.code, legacyStart.stderr).toBe(0);
      expect(await liveBridgePids(fixture)).toEqual([]);

      const upgrade = await runLifecycle("install", fixture.environment);
      expect(upgrade.code, upgrade.stderr).toBe(0);
      await expect.poll(() => liveBridgePids(fixture)).toHaveLength(1);

      const state = await readFixtureJson(
        join(fixture.state, "systemctl.json"),
      );
      expect(state).toMatchObject({ active: true, enabled: true });
      expect(state.workingDirectory).not.toBe(legacyRelease);
      expect(
        await readFile(
          join(fixture.config, "systemd/user/trace-ml-web.service"),
          "utf8",
        ),
      ).toContain("--bedrock-bridge");
      await expect(
        readFile(join(legacyRelease, ".deployed"), "utf8"),
      ).resolves.toBe("");
      expect((await runLifecycle("status", fixture.environment)).code).toBe(0);
    },
    30_000,
  );

  test(
    "restores a running legacy release after a failed bridge cutover",
    async () => {
      const fixture = await createFixture();
      const legacyRelease = await seedLegacyInstallation(fixture);
      const unitPath = join(
        fixture.config,
        "systemd/user/trace-ml-web.service",
      );
      const legacyUnit = await readFile(unitPath, "utf8");
      const legacyStart = await runLifecycle("start", fixture.environment);
      expect(legacyStart.code, legacyStart.stderr).toBe(0);

      const failedUpgrade = await runLifecycle("install", {
        ...fixture.environment,
        TRACE_ML_TEST_FAIL_ROUTE_CONFIGURE: "1",
      });
      expect(failedUpgrade.code).toBe(1);
      expect(failedUpgrade.stderr).toContain(
        "Tailscale did not establish Trace ML's exclusive HTTPS route",
      );
      await expect.poll(() => liveBridgePids(fixture)).toEqual([]);

      expect(await readFile(unitPath, "utf8")).toBe(legacyUnit);
      expect(
        await readFixtureJson(join(fixture.state, "systemctl.json")),
      ).toMatchObject({
        active: true,
        enabled: true,
        workingDirectory: legacyRelease,
      });
      expect(await readdir(join(fixture.data, "trace-ml-web/releases"))).toEqual(
        ["legacy-release"],
      );
      expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual(
        {
          [fixture.httpsPort]: `http://127.0.0.1:${fixture.localPort}`,
        },
      );
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

  test("rolls back when the active service cannot execute its Tailnet guard", async () => {
    const fixture = await createFixture();
    const install = await runLifecycle("install", fixture.environment);
    expect(install.code, install.stderr).toBe(0);
    const unitPath = join(
      fixture.config,
      "systemd/user/trace-ml-web.service",
    );
    const originalUnit = await readFile(unitPath, "utf8");
    const originalState = await readFixtureJson(
      join(fixture.state, "systemctl.json"),
    );
    const originalReleases = await readdir(
      join(fixture.data, "trace-ml-web/releases"),
    );

    const failedRestart = await runLifecycle("restart", {
      ...fixture.environment,
      TRACE_ML_TEST_FAIL_POST_CUTOVER_GUARD: "1",
    });
    expect(failedRestart.code).toBe(1);
    expect(failedRestart.stderr).toContain(
      "candidate Trace ML release failed its active Tailnet guard check",
    );
    expect(failedRestart.stderr).not.toContain("release validation failed");

    expect(await readFile(unitPath, "utf8")).toBe(originalUnit);
    expect(
      await readFixtureJson(join(fixture.state, "systemctl.json")),
    ).toMatchObject({
      active: true,
      enabled: true,
      workingDirectory: originalState.workingDirectory,
    });
    expect(await readdir(join(fixture.data, "trace-ml-web/releases"))).toEqual(
      originalReleases,
    );
    expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual({
      [fixture.httpsPort]: `http://127.0.0.1:${fixture.localPort}`,
    });
    expect(
      (await runLifecycle("status", fixture.environment)).stdout,
    ).toContain("Bedrock: available (openai.gpt-5.6-sol");
  }, 30_000);

  test(
    "keeps the active installation when uninstall cannot remove the route",
    async () => {
      const fixture = await createFixture();
      const install = await runLifecycle("install", fixture.environment);
      expect(install.code, install.stderr).toBe(0);

      const partial = await runLifecycle("uninstall", {
        ...fixture.environment,
        TRACE_ML_TEST_FAIL_ROUTE_OFF: "1",
      });
      expect(partial.code).toBe(1);
      expect(partial.stderr).toContain(
        "could not remove Trace ML's route and stop the service",
      );
      expect(partial.stderr).not.toContain(
        `tailscale serve --yes --https=${fixture.httpsPort} off`,
      );
      expect(
        await readFixtureJson(join(fixture.state, "systemctl.json")),
      ).toMatchObject({ active: true, enabled: true });
      expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual({
        [fixture.httpsPort]: `http://127.0.0.1:${fixture.localPort}`,
      });
      await expect(
        readFile(
          join(fixture.config, "systemd/user/trace-ml-web.service"),
          "utf8",
        ),
      ).resolves.toContain("Trace ML");
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

  test("keeps the service active when stop cannot remove its route", async () => {
    const fixture = await createFixture();
    const install = await runLifecycle("install", fixture.environment);
    expect(install.code, install.stderr).toBe(0);

    const stopped = await runLifecycle("stop", {
      ...fixture.environment,
      TRACE_ML_TEST_FAIL_ROUTE_OFF: "1",
    });
    expect(stopped.code).toBe(1);
    expect(stopped.stderr).toContain(
      "could not remove Trace ML's route and stop the local service",
    );
    expect(
      await readFixtureJson(join(fixture.state, "systemctl.json")),
    ).toMatchObject({ active: true, enabled: true });
    expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual({
      [fixture.httpsPort]: `http://127.0.0.1:${fixture.localPort}`,
    });
  }, 30_000);

  test("does not overwrite a route claimed during service rollback", async () => {
    const fixture = await createFixture();
    const install = await runLifecycle("install", fixture.environment);
    expect(install.code, install.stderr).toBe(0);
    const conflictingTarget = "http://127.0.0.1:65530";

    const stopped = await runLifecycle("stop", {
      ...fixture.environment,
      TRACE_ML_TEST_FAIL_SYSTEMCTL_DISABLE: "1",
      TRACE_ML_TEST_ROUTE_ON_DISABLE_FAILURE: conflictingTarget,
    });

    expect(stopped.code).toBe(1);
    expect(stopped.stderr).toContain(
      "rollback did not overwrite the newly claimed route",
    );
    expect(
      await readFixtureJson(join(fixture.state, "systemctl.json")),
    ).toMatchObject({ active: true, enabled: true });
    expect(await readFixtureJson(join(fixture.state, "routes.json"))).toEqual({
      [fixture.httpsPort]: conflictingTarget,
    });
  }, 30_000);

  test("reports a Funnel path to the protected backend as unhealthy", async () => {
    const fixture = await createFixture();
    const install = await runLifecycle("install", fixture.environment);
    expect(install.code, install.stderr).toBe(0);

    const status = await runLifecycle("status", {
      ...fixture.environment,
      TRACE_ML_TEST_FUNNEL_TARGET:
        `http://127.0.0.1:${fixture.localPort}/_trace/bedrock/lesson-helper`,
    });
    expect(status.code).toBe(1);
    expect(status.stderr).toContain(
      "tailnet route is absent, shared, public, or points elsewhere",
    );
  }, 30_000);

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
