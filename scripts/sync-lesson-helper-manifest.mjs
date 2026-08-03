import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = path.resolve(import.meta.dirname, "..");
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
      return [
        `Prediction prompt: ${activity.checkpoint.prompt}`,
        `Visible options: ${
          activity.checkpoint.options.map((option) => option.label).join("; ")
        }`,
      ];
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
  const manifest = lessons.map((lesson) => ({
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
    lessonNumber: lesson.number,
    lessonTitle: lesson.title,
    lessonQuestion: lesson.question,
    lessonSummary: lesson.summary,
    mechanism: lesson.mechanism ?? null,
    chunks: lesson.blocks.flatMap((block) =>
      block.body.map((text, index) => ({
        id: `${block.id}:p${index + 1}`,
        blockId: block.id,
        heading: block.heading,
        text,
        tags: block.tags,
      }))
    ),
    activityContext: lesson.activities.flatMap(activityContext),
  }));

  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${manifest.length} authored lesson contexts to ${path.relative(root, outputPath)}.`,
  );
} finally {
  await server.close();
}
