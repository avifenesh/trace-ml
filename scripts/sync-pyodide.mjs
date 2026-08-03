import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "node_modules", "pyodide");
const outputRoot = join(root, "public", "pyodide");
const coreAssets = [
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
];
const requestedPackages = ["numpy", "scikit-learn"];
const externalPackages = {
  autograd: {
    depends: ["numpy"],
    file_name: "autograd-1.9.1-py3-none-any.whl",
    imports: ["autograd"],
    install_dir: "site",
    name: "autograd",
    package_type: "package",
    sha256:
      "b788bae3fa010cbffb4cfb7b8ba2a3f0daa6072a8506da6164c779fe9cf3e05a",
    source:
      "https://files.pythonhosted.org/packages/6e/ce/8c98e6604bb1ec9d03c8493c328185b69bb7533fe08f3640f0f3641bd9d1/autograd-1.9.1-py3-none-any.whl",
    unvendored_tests: false,
    version: "1.9.1",
  },
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function verifiedFile(path, expectedDigest) {
  try {
    return sha256(await readFile(path)) === expectedDigest;
  } catch {
    return false;
  }
}

async function downloadVerified(url, path, expectedDigest) {
  if (await verifiedFile(path, expectedDigest)) return;

  const temporaryPath = `${path}.download`;
  await rm(temporaryPath, { force: true });
  const response = await fetch(url, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualDigest = sha256(bytes);
  if (actualDigest !== expectedDigest) {
    throw new Error(
      `Checksum mismatch for ${url}: expected ${expectedDigest}, got ${actualDigest}`,
    );
  }
  await writeFile(temporaryPath, bytes);
  await rename(temporaryPath, path);
}

function dependencyClosure(lockfile, names) {
  const packages = new Set();
  const visit = (name) => {
    if (packages.has(name)) return;
    const metadata = lockfile.packages[name];
    if (!metadata) throw new Error(`Unknown Pyodide package: ${name}`);
    packages.add(name);
    metadata.depends.forEach(visit);
  };
  names.forEach(visit);
  return [...packages];
}

await mkdir(outputRoot, { recursive: true });
await Promise.all(
  coreAssets.map((asset) =>
    copyFile(join(packageRoot, asset), join(outputRoot, asset)),
  ),
);

const packageJson = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const lockfile = JSON.parse(
  await readFile(join(packageRoot, "pyodide-lock.json"), "utf8"),
);
Object.assign(lockfile.packages, externalPackages);

const bundledPackageNames = dependencyClosure(lockfile, [
  ...requestedPackages,
  ...Object.keys(externalPackages),
]);
await Promise.all(
  bundledPackageNames.map(async (name) => {
    const metadata = lockfile.packages[name];
    const source =
      metadata.source ??
      `https://cdn.jsdelivr.net/pyodide/v${packageJson.version}/full/${metadata.file_name}`;
    await downloadVerified(
      source,
      join(outputRoot, metadata.file_name),
      metadata.sha256,
    );
  }),
);

await writeFile(
  join(outputRoot, "pyodide-lock.json"),
  `${JSON.stringify(lockfile)}\n`,
);
await writeFile(
  join(outputRoot, "runtime.json"),
  `${JSON.stringify(
    {
      pyodideVersion: packageJson.version,
      assets: [...coreAssets, "pyodide-lock.json"],
      packages: bundledPackageNames.map((name) => {
        const metadata = lockfile.packages[name];
        return {
          name,
          version: metadata.version,
          file: metadata.file_name,
          sha256: metadata.sha256,
        };
      }),
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Synced Pyodide ${packageJson.version} with ${bundledPackageNames.length} pinned scientific packages.`,
);
