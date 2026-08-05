import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${String(actual)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
const citation = parseYaml(readText("CITATION.cff"));
const changelog = readText("CHANGELOG.md");
const cargoMetadata = JSON.parse(
  execFileSync(
    "cargo",
    [
      "metadata",
      "--format-version",
      "1",
      "--no-deps",
      "--locked",
      "--manifest-path",
      path.join(repoRoot, "src-tauri/Cargo.toml"),
    ],
    { encoding: "utf8" },
  ),
);
const cargoPackage = cargoMetadata.packages.find(
  (candidate) => candidate.name === "trace-ml",
);
if (!cargoPackage) {
  throw new Error("Cargo metadata does not contain the trace-ml package.");
}

assertEqual("npm/Cargo version", packageJson.version, cargoPackage.version);
assertEqual("npm/Tauri version", packageJson.version, tauriConfig.version);
assertEqual("Cargo minimum Rust", cargoPackage.rust_version, "1.88.0");
assertEqual("npm private", packageJson.private, true);
assert(
  Array.isArray(cargoPackage.publish) && cargoPackage.publish.length === 0,
  "Cargo package must set publish = false.",
);
assertEqual("npm lock version", packageLock.version, packageJson.version);
assertEqual(
  "npm lock root version",
  packageLock.packages?.[""]?.version,
  packageJson.version,
);
assertEqual("npm license", packageJson.license, "MIT");
assertEqual("npm lock license", packageLock.packages?.[""]?.license, "MIT");
assertEqual("Cargo license", cargoPackage.license, "MIT");
assertEqual(
  "npm Node engines",
  packageJson.engines?.node,
  "^22.22.2 || ^24.15.0 || >=26.0.0",
);
assertEqual(
  "npm lock Node engines",
  packageLock.packages?.[""]?.engines?.node,
  packageJson.engines.node,
);
if (citation.version !== undefined) {
  assertEqual("citation version", String(citation.version), packageJson.version);
}
assertEqual("citation license", citation.license, "MIT");
assertEqual(
  "citation repository",
  citation["repository-code"],
  "https://github.com/avifenesh/trace-ml",
);
assertEqual("Tauri identifier", tauriConfig.identifier, "com.avifenesh.traceml");
assertEqual(
  "npm repository",
  packageJson.repository?.url,
  "git+https://github.com/avifenesh/trace-ml.git",
);
assertEqual(
  "Cargo repository",
  cargoPackage.repository,
  "https://github.com/avifenesh/trace-ml",
);
assertEqual(".nvmrc", readText(".nvmrc").trim(), "24");
assertEqual(
  "bundled project license",
  tauriConfig.bundle?.resources?.["../LICENSE"],
  "LICENSE",
);
assertEqual(
  "bundled third-party notices",
  tauriConfig.bundle?.resources?.["../THIRD_PARTY_NOTICES.md"],
  "THIRD_PARTY_NOTICES.md",
);
assert(
  changelog.includes("## [Unreleased]"),
  "CHANGELOG.md must contain an Unreleased section.",
);

const releaseDate = citation["date-released"];
if (releaseDate !== undefined) {
  assert(
    citation.version !== undefined,
    "A released citation must include the released version.",
  );
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(String(releaseDate)),
    "CITATION.cff date-released must use YYYY-MM-DD.",
  );
  const releaseHeading = `## [${packageJson.version}] - ${releaseDate}`;
  assert(
    changelog.includes(releaseHeading),
    `CHANGELOG.md is missing: ${releaseHeading}`,
  );
}

if (process.env.TRACE_ML_REQUIRE_RELEASE_TAG === "1") {
  assert(
    releaseDate !== undefined,
    "A release tag requires date-released in CITATION.cff.",
  );
  assert(
    citation.version !== undefined,
    "A release tag requires version in CITATION.cff.",
  );
  const tag = `v${packageJson.version}`;
  const tagType = execFileSync(
    "git",
    ["cat-file", "-t", `refs/tags/${tag}`],
    { cwd: repoRoot, encoding: "utf8" },
  ).trim();
  assertEqual(`release tag ${tag} type`, tagType, "tag");
  const tagCommit = execFileSync(
    "git",
    ["rev-list", "-n", "1", `refs/tags/${tag}`],
    { cwd: repoRoot, encoding: "utf8" },
  ).trim();
  const headCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  assertEqual(`release tag ${tag}`, tagCommit, headCommit);
}

const requiredFiles = [
  "CHANGELOG.md",
  "CITATION.cff",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "AGENTS.md",
  "docs/maintainers/repository-launch.md",
];
for (const relativePath of requiredFiles) {
  readText(relativePath);
}

const yamlFiles = [
  ".github/dependabot.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/course_content.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/question.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/dependency-audit.yml",
  ".github/workflows/macos-build.yml",
];
const parsedYaml = new Map();
for (const relativePath of yamlFiles) {
  const value = parseYaml(readText(relativePath));
  assert(
    value !== null,
    `${relativePath} must contain YAML data.`,
  );
  parsedYaml.set(relativePath, value);
}

function collectUses(value, uses = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectUses(item, uses);
    return uses;
  }
  if (value === null || typeof value !== "object") return uses;
  for (const [key, item] of Object.entries(value)) {
    if (key === "uses") {
      assert(typeof item === "string", "Workflow uses values must be strings.");
      uses.push(item);
    } else {
      collectUses(item, uses);
    }
  }
  return uses;
}

for (const relativePath of yamlFiles.filter((value) =>
  value.startsWith(".github/workflows/"),
)) {
  for (const action of collectUses(parsedYaml.get(relativePath))) {
    if (action.startsWith("./")) continue;
    const separator = action.lastIndexOf("@");
    const reference = separator >= 0 ? action.slice(separator + 1) : "";
    assert(
      /^[0-9a-f]{40}$/.test(reference),
      `${relativePath} must pin ${action} to a full commit SHA.`,
    );
  }
}

const trackedFiles = [
  ...requiredFiles,
  ...yamlFiles,
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "public/trace-ml-maskable-512.png",
  "scripts/compress-production-assets.mjs",
  "scripts/compress-production-assets.test.mjs",
  "scripts/inspect-listener-owner.mjs",
  "scripts/inspect-listener-owner.test.mjs",
  "scripts/inspect-tailnet-route.mjs",
  "scripts/inspect-tailnet-route.test.mjs",
  "scripts/manage-tailnet.sh",
  "scripts/manage-tailnet.test.mjs",
  "scripts/serve-production.mjs",
  "scripts/serve-production.test.mjs",
  "scripts/smoke-installed-desktop.sh",
  "scripts/smoke-installed-linux.sh",
  "scripts/smoke-installed-macos.sh",
];
for (const relativePath of new Set(trackedFiles)) {
  execFileSync(
    "git",
    ["ls-files", "--error-unmatch", "--", relativePath],
    { cwd: repoRoot, stdio: "ignore" },
  );
}

console.log(
  `Verified Trace ML ${packageJson.version} repository metadata and ` +
    `${requiredFiles.length} project-health files in the Git snapshot.`,
);
