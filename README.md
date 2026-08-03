# Trace ML

Trace ML is an inspectable, evidence-led machine-learning course delivered as a
React web app and a Tauri desktop app. The curriculum is fixed and pre-authored:
all 21 published lessons are visible and selectable from the first run.
Objective checkpoints record supported predictions, controlled comparisons,
and executable checks; they do not claim durable retention, unlock, generate,
or reorder course material. Free-form explanation and transfer prompts are
formative drafts. Their local checker reports structural coverage only and
never certifies semantic correctness.

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

Lesson completion uses only objectively checkable prediction, comparison, and
code activities. The prose surface exposes the authored review criteria and
can point out missing terms, but it records at most partial evidence because a
deterministic keyword matcher cannot judge causal meaning.

Each of the 194 authored page paragraphs carries source IDs from a
103-source research registry. The compact editorial citations under reading
blocks are separate from optional resources and never record learner activity.

Every lesson begins with an authored prediction before its mechanism and code
labs are revealed. Committing either a supported or unsupported prediction
enables those labs; correctness changes the feedback, not course access.

## Page-Grounded Helper

The optional helper answers questions about the current lesson. It is a local,
deterministic retrieval helper, not an LLM-directed teacher:

- Only paragraphs from the active authored lesson are searchable.
- Lexical retrieval selects up to three relevant page chunks and cites them.
- CBR-style question cases choose a response frame for definition, causal,
  contrast, or boundary questions. They do not supply facts.
- If the active page does not support an answer, the helper abstains.
- It never creates or selects material, teaches a separate lesson, sequences
  work, grades, estimates mastery, unlocks lessons, or changes progress.

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

Practice runs reuse a worker. **Check work** runs the submitted code and the
authored checks in a fresh worker, with a fixed seed, timeout, and output quota,
then destroys that worker. Stop, timeout, lesson navigation, and component
teardown all force termination after a short cooperative-interrupt grace
period. Fourteen labs use the Python standard library only.
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
- `trace-ml:active-thread:v1`: the selected helper thread.
- `trace-ml:active-lesson:v1`: the last selected authored lesson.

State belongs to the current browser or Tauri webview profile. There is no
account or cloud sync, and clearing site storage resets it. Same-origin windows
serialize learner-record writes with the Web Locks API, re-read and merge the
latest ledger inside the lock, and synchronize subsequent storage events.
Malformed or orphaned evidence is discarded during normalization.

If browser storage is unavailable, activity continues in memory for that
session and the compact toolbar displays **Session only**. That warning means
the current evidence will not survive a reload.

## Development

Requirements are Node.js with npm. Install dependencies and start Vite:

```bash
npm install
npm run dev
```

The app is served at `http://127.0.0.1:5173`; that port is strict. `npm run dev`
automatically synchronizes the local Pyodide assets.

| Command | Purpose |
| --- | --- |
| `npm run sync:pyodide` | Refresh `public/pyodide/` from the pinned package |
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
It starts or reuses the Vite server on port `5173`. Browser course-flow tests
and the real Pyodide runtime test live in `e2e/`; saved failure traces are
written to `outputs/playwright/`.

## Tauri Desktop

The desktop shell requires Node.js/npm, a Rust toolchain compatible with the
manifest's Rust `1.77.2` minimum, and the platform dependencies required by
Tauri 2. On Debian or Ubuntu, install the
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

Run the desktop app in development or build release bundles:

```bash
npm run tauri dev
npm run tauri build
```

Tauri runs the configured Vite command before development and `npm run build`
before bundling the generated `dist/` frontend. Bundle targets are selected
from those supported by the current host.

On this machine, the local release is available as **Trace ML** in the
applications menu and as `~/Desktop/Trace ML.desktop`. Double-click either
launcher; startup diagnostics are written to
`~/.cache/trace-ml/launcher.log`.

## Repository Map

- `src/content/`: the fixed course, lesson types, activities, resources, and
  authored checks.
- `src/learning/`: evidence recording, rubrics, progression state, and local
  learner persistence.
- `src/tutor/`: page-chunk retrieval, CBR response framing, and persisted
  lesson threads.
- `src/runtime/`: the Pyodide worker, execution limits, and clean assessment
  protocol.
- `e2e/`: browser course-flow and real-runtime Playwright tests.
- `src-tauri/`: Tauri 2 application, permissions, bundle configuration, and
  Rust entry points.

The research synthesis is in
[`agent-knowledge/ml-course-research.md`](agent-knowledge/ml-course-research.md).
Its 103-source registry is
[`agent-knowledge/resources/ml-course-research-sources.json`](agent-knowledge/resources/ml-course-research-sources.json).
Source IDs in lesson content resolve against that registry; the guide also
records synthesized design decisions and known evidence gaps.
