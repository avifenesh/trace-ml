import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = path.resolve(import.meta.dirname, "..");
const checkOnly = process.argv.slice(2).includes("--check");
const outputPath = path.join(
  root,
  "src-tauri/prose-assessment-manifest.json",
);
const server = await createServer({
  root,
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { lessons } = await server.ssrLoadModule("/src/content/course.ts");
  const { lessonContextForAssessment } = await server.ssrLoadModule(
    "/src/content/types.ts",
  );
  const manifest = lessons.flatMap((lesson) => {
    const lessonContext = lessonContextForAssessment(lesson);

    return lesson.activities
      .filter((activity) => activity.kind === "text-response")
      .map((activity) => ({
        lessonId: lesson.id,
        lessonRevision: lesson.revision ?? "unversioned",
        lessonTitle: lesson.title,
        lessonContext,
        activityId: activity.id,
        activityPrompt: activity.prompt,
        activityGuidance: activity.guidance,
        criteria: activity.rubric.criteria.map(({ id, label }) => ({
          id,
          label,
        })),
        demonstratedFeedback: activity.rubric.demonstratedFeedback,
        unsupportedFeedback: activity.rubric.unsupportedFeedback,
      }));
  });

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (checkOnly) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== serialized) {
      throw new Error(
        `${path.relative(root, outputPath)} is stale. Run npm run sync:prose-manifest.`,
      );
    }
    console.log(
      `Verified ${manifest.length} authored prose rubrics in ${path.relative(root, outputPath)}.`,
    );
  } else {
    await writeFile(outputPath, serialized);
    console.log(
      `Wrote ${manifest.length} authored prose rubrics to ${path.relative(root, outputPath)}.`,
    );
  }
} finally {
  await server.close();
}
