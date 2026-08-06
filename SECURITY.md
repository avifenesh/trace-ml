# Security Policy

## Supported Versions

Trace ML is pre-1.0. Security fixes target `main` and the latest published
`0.1.x` release, once one exists. Older snapshots are not supported.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability. Use
[GitHub private vulnerability reporting](https://github.com/avifenesh/trace-ml/security/advisories/new).
If that form is unavailable, email
[aviarchi1994@gmail.com](mailto:aviarchi1994@gmail.com). Do not include
vulnerability details in a public issue.

Include the commit or version, operating system, affected mode (browser or
desktop), the smallest reproduction, realistic impact, and relevant sanitized
logs. Do not include live AWS credentials, learner data, private account
content, or destructive proof-of-concept payloads.

## System and Scope

Trace ML is a local React and Tauri desktop course. It has no account system or
hosted application server. Security-sensitive surfaces include:

- the Tauri webview-to-Rust IPC boundary
- Bedrock credential loading and outbound HTTPS requests
- trusted lesson, helper, rubric, and external-URL manifests
- learner-controlled prose and Python submissions
- Pyodide worker lifecycle, output limits, and protocol validation
- local persistence and lesson-scoped conversation state
- native build, install, launcher, and update scripts

Reports about credential exposure, arbitrary native command execution,
unapproved external navigation, manifest-authority bypasses, cross-lesson data
confusion, unsafe installer replacement, or denial-of-service paths that cross
the documented bounds are in scope.

## Threat Model and Security Invariants

Learner text, Python source, local storage, model output, remote responses, and
external resource URLs are untrusted. The operating-system user and the local
application installation are trusted.

The following properties must hold:

- Bedrock credentials remain in the Rust desktop or Tailnet bridge process and
  are never returned to the webview, browser, logs, or learner-visible output.
- Client input can select only compiled authored lesson and activity IDs.
- The Tailnet server accepts Bedrock work only on fixed same-origin course
  routes. Those routes cannot forward an arbitrary model, prompt, endpoint, or
  tool request. They reject Tailscale's Funnel marker and fail closed unless the
  live private Serve route remains exclusively owned and no Funnel forwards to
  the Trace ML loopback backend.
- Helper and prose-assessment output is schema-validated and cannot create or
  reorder material, answer protected activities, change access, or claim
  mastery.
- External URLs must match compiled authored scopes before the native opener is
  invoked.
- Learner Python cannot use browser APIs or the Pyodide JavaScript bridge, and
  each run is isolated in a disposable worker with bounded time and output.
- Protocol messages, persisted data, and remote response sizes are validated
  before use.
- Installers must validate their source artifact and restore the previous
  installation if staging or smoke verification fails.

## Known Limitations and Accepted Risk

- Pyodide worker isolation is browser-process isolation, not an OS sandbox. A
  memory-exhausting Python submission can pressure or terminate its renderer
  process. Do not treat mutually distrusting learner code as safely isolated.
- Local state is readable and mutable by other processes running as the same
  operating-system user. Trace ML does not provide local multi-user isolation.
- Bedrock requests are subject to the configured AWS account, model, and
  retention policies. The application requests no tools and no retrievable
  response state, but that is not a guarantee of zero provider retention.
- The Linux Tauri 2 stack currently inherits the unmaintained gtk-rs GTK3
  bindings and `glib` 0.18. RustSec flags an unsound `VariantStrIter` path as
  [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
  Trace ML does not call that API, and
  [Tauri reports no affected internal path](https://github.com/tauri-apps/tauri/issues/12048),
  but the dependency cannot be upgraded independently of Tauri's GTK backend.
- RustSec also reports unmaintained `proc-macro-error` through the same GTK3
  bindings and five unmaintained `unic-*` crates through Tauri's `urlpattern`
  dependency. These are transitive Tauri dependencies rather than direct Trace
  ML choices. The weekly audit remains blocking for vulnerability advisories;
  informational maintenance warnings are reviewed before each release.
- Links intentionally leave the application after exact authored-scope
  validation. The destination site remains outside Trace ML's security
  boundary.

These limitations do not exclude reports where the implementation exceeds the
documented exposure or bypasses a stated invariant.
