import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = path.resolve(import.meta.dirname, "..");
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

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${manifest.length} authored prose rubrics to ${path.relative(root, outputPath)}.`,
  );
} finally {
  await server.close();
}
