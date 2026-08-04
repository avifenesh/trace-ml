# Trace ML

Trace ML is an inspectable, evidence-led machine-learning course delivered as a
React web app and a Tauri desktop app. The curriculum is fixed and pre-authored:
all 21 published lessons are visible and selectable from the first run.
Objective checkpoints record supported predictions and executable checks.
Controlled comparisons remain saved experiment state rather than comprehension
evidence. None of these signals claims durable retention, unlocks, generates, or
reorders course material. Free-form explanation and transfer prompts remain
formative drafts and never control access or objective completion.

## Quick Start on Another Machine

Trace ML builds natively on Linux and macOS. Install Node 24 LTS and the stable
Rust toolchain. On macOS Catalina 10.15 or newer, also install Apple's desktop
build tools:

```bash
xcode-select --install
```

Clone this private repository, then run the first-machine setup:

```bash
git clone https://github.com/avifenesh/trace-ml.git
cd trace-ml
make doctor
make first-run
```

`make first-run` installs the pinned dependencies, verifies the project, builds
the native app, installs it for the current user, and opens it. On macOS the app
is installed at `~/Applications/Trace ML.app`; on Linux the existing
applications-menu and desktop launchers are installed. Subsequent launches need
only:

```bash
make start
```

The application works without Bedrock credentials by using its local,
page-grounded fallback. To enable semantic Q&A and prose review in a
Finder-launched macOS app, put
`AWS_BEARER_TOKEN_BEDROCK=<your token>` in
`~/.config/claude/bedrock.env` and restrict that file to the current user with
`chmod 600`. Never commit that file or token.

Git synchronizes the authored course and application code. Learner progress and
helper conversations remain local to each machine and are not synced through
GitHub.

## Course

The course contains seven authored modules:

| Module | Lessons |
| --- | ---: |
| Prediction and error | 4 |
| Learning and evidence | 3 |
| Decisions and features | 3 |
| Model families | 3 |
| Neural mechanisms | 3 |
| Representation and sequence | 3 |
| Acting and deployment | 2 |

Lessons combine authored reading with prediction, mechanism manipulation,
explanation or transfer prompts, and, where specified, executable code. The
current course includes 19 Python labs and 41 optional external resources:
23 readings, 12 interactives, two videos, and four combined video-and-reading
pages. Opening a resource records exposure only; authored activities provide
immediate evidence without inferring retention or mastery.

Lesson completion uses only objectively checkable prediction and code
activities. In the desktop app, a bounded Bedrock model classifies prose against
the current authored page and rubric. Rust derives the formative level and
renders novice-appropriate revision direction from authored course strings; the
model cannot write feedback or replacement teaching. It accepts reasonable
paraphrases and does not require expert wording. The browser build retains a
deterministic structure-only fallback when the desktop command is unavailable.

The prose assessor may label the submitted activity `unsupported`, `partial`,
or `demonstrated`, but that immediate formative label is not evidence of
retention or mastery and is excluded from lesson completion. It cannot change
the rubric, lesson sequence, course material, helper conversation, or learner
access.

The 204 focused reading paragraphs and 489 teaching chunks form 693
source-linked page chunks backed by a 109-source research registry. Compact
editorial citations under teaching and reading blocks are separate from
optional resources and never record learner activity.

Every lesson begins with its outcomes, an authored explanation, essential
terms, one complete worked example, misconception corrections, and then an
analogous prediction whose answer was not already shown. Committing either a
supported or unsupported prediction enables the interactive mechanism and code
labs; correctness changes the feedback, not course access.

## Page-Grounded Helper

The optional helper answers questions about the current lesson. In the desktop
app, a bounded Bedrock model explains page wording; the browser build uses a
deterministic exact-page fallback. Neither path is an LLM-directed teacher:

- Rust resolves only the active lesson and revision from a generated manifest
  compiled into the app.
- Every semantic claim carries an adjacent page citation and an exact authored
  quote that Rust validates before the answer reaches the webview.
- A deterministic preflight rejects grading, hints, activity answers,
  generated material, sequencing, progression, prompt overrides, and
  cross-page requests before inference.
- The browser fallback retrieves up to three page chunks and uses CBR-style
  question frames that never supply facts.
- If the active page does not support an answer, the helper abstains.
- It never creates or selects material, teaches a separate lesson, sequences
  work, grades, estimates mastery, unlocks lessons, or changes progress.

The helper and prose assessor are separate features. Asking the helper to grade
an answer is still refused; only the authored explanation form can invoke the
bounded rubric review.

Conversation history is stored in separate lesson-scoped threads. Each answer
is still grounded from the submitted question and the current page, rather than
using chat history as course content or learning evidence.

## Local Python

Python labs run locally in a dedicated Web Worker using pinned Pyodide
`314.0.3` and Python `3.14.2`. There is no remote execution service.

`predev` and `prebuild` copy the Pyodide module, WebAssembly binary, lockfile,
and standard library from `node_modules/pyodide` into the ignored
`public/pyodide/` directory. The sync step also downloads any missing
scientific wheels and verifies each one against its pinned SHA-256 digest.
Vite and Tauri then serve every runtime asset from the same origin; lesson
execution never fetches a package from the network. The development server
also sets the cross-origin isolation headers needed for interrupt support.

Every practice run starts in a fresh worker and destroys it afterward. **Check
work** likewise runs the submitted code and authored checks in a separate fresh
worker, with a fixed seed, timeout, and output quota, then destroys that worker.
Stop, timeout, lesson navigation, and component teardown all force termination
after a short cooperative-interrupt grace period. Fourteen labs use the Python
standard library only.
Five scientific labs load pinned, checksum-verified local wheels for NumPy
`2.4.3`, scikit-learn `1.8.0`, or autograd `1.9.1`; no package is fetched at
lesson runtime.

The worker exposes a frozen empty `js` module, revokes Pyodide's
`pyodide_js` bridge after package loading, and communicates with the app over
a transferred private `MessagePort`. Learner code is synchronous and cannot
use browser APIs. Every protocol message is runtime-validated, and stdout,
stderr, result, check, and error strings are UTF-8 byte-capped before
structured cloning.

This is browser-process isolation, not an OS sandbox. Timeouts can terminate a
worker, but WebAssembly in the browser does not provide an enforceable
per-execution Python heap limit. A memory-exhausting submission can therefore
still pressure or terminate the worker process; no learner code or secrets
should be treated as mutually distrusting within that browser process.

## Persistence

Trace ML persists local state with `localStorage`:

- `trace-ml:learner-record:v1`: activity attempts, resource opens, and concept
  evidence.
- `trace-ml:tutor-threads:v1`: lesson-scoped helper conversations.
- `trace-ml:tutor-thread-deleted:v1:*`: durable per-thread deletion markers
  that prevent stale same-origin windows from restoring deleted conversations.
- `trace-ml:active-thread:v1`: the selected helper thread.
- `trace-ml:active-lesson:v1`: the last selected authored lesson.
- `trace-ml:activity-state:v1:*`: revision-scoped drafts and formative prose
  feedback.

State belongs to the current browser or Tauri webview profile. There is no
account or cloud sync, and clearing site storage resets it. Same-origin windows
serialize learner-record writes with the Web Locks API, re-read and merge the
latest ledger inside the lock, and synchronize subsequent storage events.
Helper threads merge ordinary concurrent writes and honor explicit deletion
markers rather than inferring deletion from an absent record. Malformed or
orphaned evidence is discarded during normalization.

Desktop Q&A sends the current authored lesson, the question, and bounded recent
thread context to the configured Amazon Bedrock model. Desktop prose review
sends the authored lesson text, activity prompt and guidance, rubric labels,
and the submitted draft. The webview supplies only authored IDs and
learner text; Rust resolves trusted material from generated manifests compiled
into the app. The backend sends direct HTTPS requests to the documented Mantle
Responses endpoint with strict structured output, `tool_choice: "none"`,
`store: false`, fixed timeouts, bounded input and output, request cancellation,
and per-feature rate limits. The protected credential remains in Rust.
Browser Q&A and structure checks send nothing remotely. `store: false`
disables retrievable Responses state but does not guarantee zero retention;
AWS documents that classifier-flagged GPT-5.6 Sol traffic may be retained for
up to 30 days. Account/project retention and provider-sharing policy still
apply. Live model metadata reported `provider_data_share` on 2026-08-03, so
this installation does not establish zero data retention.

If browser storage is unavailable, activity continues in memory for that
session and the compact toolbar displays **Session only**. That warning means
the current evidence will not survive a reload.

## Development

The desktop build requires Node `^20.19.0` or `>=22.12.0`, npm, Rust `1.77.2`
or newer, and the operating-system prerequisites below. Node 24 LTS is the
recommended version; `.nvmrc` and `rust-toolchain.toml` describe the expected
toolchains.

The portable Make targets are:

| Command | Purpose |
| --- | --- |
| `make doctor` | Check Node, Rust, and native desktop prerequisites |
| `make setup` | Run deterministic `npm ci` and synchronize local runtime assets |
| `make web` | Start browser development on `127.0.0.1:5173` |
| `make dev` | Start Tauri desktop development |
| `make check` | Verify manifests, lint, types, frontend tests, and Rust tests |
| `make test-e2e` | Run browser and real-Pyodide integration tests |
| `make build` | Build native bundles for the current operating system |
| `make install` | Verify, build, and install the native app |
| `make start` | Open the installed native app |
| `make dmg` | Build a macOS DMG on a Mac |

The equivalent npm-only browser setup remains:

```bash
npm ci
npm run dev
```

The app is served at `http://127.0.0.1:5173`; that port is strict. `npm run dev`
automatically synchronizes the local Pyodide assets.

| Command | Purpose |
| --- | --- |
| `npm run sync:pyodide` | Refresh `public/pyodide/` from the pinned package |
| `npm run check:manifests` | Verify compiled lesson, rubric, and opener authority without rewriting it |
| `npm run typecheck` | Run the TypeScript project build checks |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the Vitest unit suite |
| `npm run build` | Sync Pyodide, typecheck, and build the Vite app |
| `npm run preview` | Serve the production Vite build locally |

## End-to-End Tests

```bash
npm run test:e2e
```

Playwright uses the installed Google Chrome channel at a `1440x1000` viewport.
It allocates an isolated loopback port, starts a fresh Vite server, and runs one
worker so multi-window persistence cases cannot interfere with one another.
Browser course-flow tests and the real Pyodide runtime test live in `e2e/`;
saved failure traces are written to `outputs/playwright/`.

## Tauri Desktop

The desktop shell uses Tauri 2 and must be built on the target operating
system. Run `make doctor` before setup.

### macOS

Tauri's current macOS prerequisites require Catalina 10.15 or newer and Xcode
or Xcode Command Line Tools. Desktop-only builds can use:

```bash
xcode-select --install
```

`make install` runs the core quality gates, builds the official Tauri `.app`
bundle on that Mac, validates its bundle identifier, executable, and `.icns`
icon, then transactionally installs it to `~/Applications/Trace ML.app`.
An interrupted replacement restores the previous app. `make start` opens the
installed app through macOS Launch Services.

To produce a drag-to-Applications installer on a Mac:

```bash
make dmg
```

Local source builds are intended for personal use. Sharing a binary with other
Mac users requires Apple Developer ID signing and notarization; the repository
does not contain signing credentials.

### Linux

On Debian or Ubuntu, install the
[official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Run the desktop app in development on either supported operating system:

```bash
make dev
```

Build, test, install, and verify the self-contained native release:

```bash
make install
```

On Linux, the release command additionally runs serial Playwright tests,
installs the exact built artifact, and runs the installed-app smoke with port
`5173` closed. The low-level installer is idempotent. It copies the release
binary from
`src-tauri/target/release/trace-ml`, installs the hicolor icon at 32, 64, 128,
256, and 512 pixels, refreshes the desktop and icon caches, and creates both
the **Trace ML** applications-menu entry and `Trace ML.desktop` in the
configured XDG desktop directory.
To install a different release artifact, run
`scripts/install-linux-desktop.sh --binary /absolute/path/to/trace-ml`.

The smoke test deliberately fails while anything is listening on port `5173`.
It activates the installed desktop file, establishes cleanup ownership for the
new process, proves the window's `/proc` executable and `WM_CLASS`, resolves
the installed icon through GTK, starts a fresh helper conversation, submits an
authored page question, and requires a completed local or Bedrock response. Run
`npm run desktop:smoke -- --require-bedrock` for the optional credentialed
semantic-readiness check.
Startup diagnostics are written to `~/.cache/trace-ml/launcher.log`.

The `macOS build` GitHub Actions workflow compiles and validates the `.app`
bundle on both Apple Silicon and Intel macOS runners after every push to
`main`.

Tauri uses `devUrl` only for development and embeds `frontendDist` in release
builds. The bundle category follows the official
[Tauri 2 configuration reference](https://v2.tauri.app/reference/config/);
the installed entries follow the freedesktop
[Desktop Entry](https://specifications.freedesktop.org/desktop-entry-spec/latest/)
and [Icon Theme](https://specifications.freedesktop.org/icon-theme-spec/latest/)
specifications. The macOS setup and bundle commands follow the official
[prerequisites](https://v2.tauri.app/start/prerequisites/),
[application bundle](https://v2.tauri.app/distribute/macos-application-bundle/),
and [DMG](https://v2.tauri.app/distribute/dmg/) guides (accessed 2026-08-05).

## Repository Map

- `src/content/`: the fixed course, lesson types, activities, resources, and
  authored checks.
- `src/learning/`: evidence recording, rubrics, progression state, and local
  learner persistence, including the bounded prose-assessment client.
- `src/tutor/`: page-chunk retrieval, CBR response framing, and persisted
  lesson threads.
- `src/runtime/`: the Pyodide worker, execution limits, and clean assessment
  protocol.
- `e2e/`: browser course-flow and real-runtime Playwright tests.
- `src-tauri/`: Tauri 2 application, permissions, bundle configuration, and
  the compiled authored-rubric manifest and validated direct-Bedrock command.

The research synthesis is in
[`agent-knowledge/ml-course-research.md`](agent-knowledge/ml-course-research.md).
Its 109-source registry is
[`agent-knowledge/resources/ml-course-research-sources.json`](agent-knowledge/resources/ml-course-research-sources.json).
Source IDs in lesson content resolve against that registry; the guide also
records synthesized design decisions and known evidence gaps.
