# Trace ML Repository Guidance

## Product Contract

- Trace ML is a fixed course. All lessons, sequence, teaching, activities,
  rubrics, and progression rules are authored before release.
- The chatbot is an optional helper for questions about the current page. It
  must not create, select, reorder, unlock, or replace course material.
- The prose assessor gives beginner-tolerant formative direction against an
  authored rubric. It never controls completion or claims mastery.

## Research and Authority

- Read `agent-knowledge/AGENTS.md` before changing course content, helper
  behavior, prose assessment, learning evidence, or progression.
- Back course claims with primary or authoritative sources and update the
  research registry.
- Revalidate time-sensitive ML, LLM, agent, inference, framework, operating
  system, and tooling claims online. Do not rely on stale model memory.
- Edit source content first, then regenerate and commit the trusted Tauri
  manifests with `npm run prebuild`.

## Engineering

- Preserve the browser fallback and the native Tauri path.
- Keep Bedrock credentials and trusted authority in Rust, outside the webview.
- Treat learner text, Python, local storage, model output, remote responses, and
  external URLs as untrusted.
- Do not commit credentials, learner data, local browser profiles, or raw
  private-provider responses.
- Keep unrelated worktree changes intact.

## Validation

Run the narrowest relevant tests while iterating. Before delivery, run:

```bash
make check
make test-e2e
npm run build
git diff --check
```

For native packaging, launcher, icon, IPC, or credential changes, also run
`make install` and prove `make start` in a real desktop session.
