import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = path.resolve(import.meta.dirname, "..");
const checkOnly = process.argv.slice(2).includes("--check");
const outputPath = path.join(
  root,
  "src-tauri/lesson-helper-manifest.json",
);
const server = await createServer({
  root,
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

function activityContext(activity) {
  switch (activity.kind) {
    case "prediction":
      return [];
    case "text-response":
      return [
        `Explanation prompt: ${activity.prompt}`,
        `Explanation guidance: ${activity.guidance}`,
      ];
    case "visual-lab":
      return [
        `Visual lab: ${activity.title}`,
        activity.prompt,
        activity.invariant ? `Fixed quantities: ${activity.invariant}` : "",
        activity.intervention
          ? `Learner-controlled change: ${activity.intervention}`
          : "",
        activity.control
          ? `Control: ${activity.control.label}, from ${activity.control.lowLabel} to ${activity.control.highLabel}`
          : "",
      ].filter(Boolean);
    case "code-lab":
      return [
        `Code lab instructions: ${activity.spec.instructions}`,
        ...activity.spec.starterFiles.map(
          (file) => `Authored starter file ${file.path}:\n${file.contents}`,
        ),
      ];
  }
}

try {
  const { lessons } = await server.ssrLoadModule("/src/content/course.ts");
  const { pageChunksForLesson } = await server.ssrLoadModule(
    "/src/content/types.ts",
  );
  const manifest = lessons.map((lesson) => ({
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
    lessonNumber: lesson.number,
    lessonTitle: lesson.title,
    lessonQuestion: lesson.question,
    lessonSummary: lesson.summary,
    mechanism: lesson.mechanism ?? null,
    chunks: pageChunksForLesson(lesson).map((chunk) => ({
      id: chunk.id,
      blockId: chunk.blockId,
      heading: chunk.heading,
      text: chunk.text,
      tags: chunk.tags,
    })),
    activityContext: lesson.activities.flatMap(activityContext),
  }));

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (checkOnly) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== serialized) {
      throw new Error(
        `${path.relative(root, outputPath)} is stale. Run npm run sync:helper-manifest.`,
      );
    }
    console.log(
      `Verified ${manifest.length} authored lesson contexts in ${path.relative(root, outputPath)}.`,
    );
  } else {
    await writeFile(outputPath, serialized);
    console.log(
      `Wrote ${manifest.length} authored lesson contexts to ${path.relative(root, outputPath)}.`,
    );
  }
} finally {
  await server.close();
}
