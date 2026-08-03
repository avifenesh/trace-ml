import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const registryPath = path.join(
  root,
  "agent-knowledge/resources/ml-course-research-sources.json",
);
const contentDir = path.join(root, "src/content");
const capabilityPath = path.join(
  root,
  "src-tauri/capabilities/default.json",
);

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const urls = new Set(
  registry.sources.map((source) => source.url),
);

function collectUrlProperties(node) {
  if (
    ts.isPropertyAssignment(node) &&
    ((ts.isIdentifier(node.name) && node.name.text === "url") ||
      (ts.isStringLiteral(node.name) && node.name.text === "url")) &&
    ts.isStringLiteralLike(node.initializer)
  ) {
    urls.add(node.initializer.text);
  }
  ts.forEachChild(node, collectUrlProperties);
}

for (const filename of fs.readdirSync(contentDir)) {
  if (!filename.endsWith(".ts")) continue;
  const sourceText = fs.readFileSync(
    path.join(contentDir, filename),
    "utf8",
  );
  const sourceFile = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  collectUrlProperties(sourceFile);
}

const allowedUrls = [...urls]
  .filter((url) => {
    try {
      return ["http:", "https:"].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  })
  .sort();

const capability = {
  $schema: "../gen/schemas/desktop-schema.json",
  identifier: "default",
  description: "Core app access and exact authored external course links.",
  windows: ["main"],
  permissions: [
    "core:default",
    {
      identifier: "opener:allow-open-url",
      allow: allowedUrls.map((url) => ({ url })),
    },
  ],
};

fs.writeFileSync(
  capabilityPath,
  `${JSON.stringify(capability, null, 2)}\n`,
);
console.log(
  `Wrote ${allowedUrls.length} exact opener URL scopes to ${path.relative(root, capabilityPath)}.`,
);
