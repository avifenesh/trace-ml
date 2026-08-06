# Contributing to Trace ML

Trace ML is a fixed, research-grounded course. Changes should improve the
authored material or its delivery without turning the helper into a teacher,
course generator, grader, or progression authority.

## Prerequisites

Install the latest Node 24 LTS (24.15.0 or newer), `rustup` (the repository
pins Rust 1.97.1), and the
[Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for
your operating system. Google Chrome is required only for the Playwright
end-to-end suite.

```bash
make doctor
make setup
```

## Development

Start the browser app:

```bash
make web
```

Start the native desktop app:

```bash
make dev
```

The main ownership boundaries are:

- `src/content/`: fixed lessons, activities, resources, and authored checks.
- `src/learning/`: learner evidence, formative rubrics, and persistence.
- `src/tutor/`: page retrieval, helper boundaries, and lesson conversations.
- `src/runtime/`: the local Pyodide worker and execution protocol.
- `src-tauri/`: native commands, trusted manifests, credentials, and bundles.

## Course Content Changes

Course claims must be backed by primary or authoritative sources. Update the
research registry in
`agent-knowledge/resources/ml-course-research-sources.json`, use its source IDs
in authored content, and update the synthesis when a design decision changes.

All lessons must remain present from the first run. Do not add model-generated
lessons, adaptive sequencing, mastery claims, or helper-controlled access.

After changing lessons, rubrics, helper authority, or external resources, run:

```bash
npm run prebuild
npm run check:manifests
```

Commit the generated Tauri manifests with their source changes.

## Quality Gates

Run the required local quality gates:

```bash
make check
make test-e2e
npm run build
git diff --check
```

CI additionally reproduces setup from a clean checkout, checks that generation
leaves tracked source unchanged, runs repository linters, builds native
packages, and exercises supported installed-app paths.

For native packaging, launcher, icon, IPC, or credential changes, also run:

```bash
make install
make smoke
```

Describe the operating system and architecture used for native validation.
Never include real credentials, learner data, local browser profiles, or raw
Bedrock responses in fixtures, screenshots, logs, or commits.

## Pull Requests

- Keep each change focused on one concern.
- Explain the user-visible effect and why the change is needed.
- Include the exact checks and action tests that passed.
- Add or update tests for changed behavior.
- Update the README, changelog, and research record when their contracts move.
- Use concise conventional commit prefixes such as `feat:`, `fix:`, `docs:`,
  `test:`, and `chore:`.

By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues must be reported
privately as described in [SECURITY.md](SECURITY.md).

Unless stated otherwise, contributions submitted to this repository are
licensed under the project's [MIT License](LICENSE).

Third-party dependencies retain their upstream licenses. Update
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) when a bundled runtime
component or its license changes.
