# Changelog

All notable changes to Trace ML will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Update frontend dependencies and align the Tauri 2.12 JavaScript and Rust stack with opener 2.7. Raise the minimum Rust version to 1.90.0.
- Refresh the bundled Pyodide runtime to 314.0.7, including runtime identities, license source, and browser assertions.

- The Bedrock helper and prose review use `openai.gpt-6-sol` instead of
  `openai.gpt-5.6-sol`, after the seven live acceptance probes passed on it.

### Added

- A fixed, pre-authored course with 21 lessons across seven machine-learning
  modules.
- Authored teaching, prediction, mechanism, explanation, transfer, and Python
  activities with objective lesson checks.
- Nineteen offline Python labs using pinned Pyodide and checksum-verified
  scientific packages.
- A page-grounded optional helper and bounded formative prose assessment, with
  deterministic browser fallbacks and validated Bedrock desktop paths.
- Local learner-state and lesson-scoped conversation persistence.
- Native Tauri desktop packaging, transactional installation, custom icons, and
  installed-app smoke verification for Linux.
- Portable `make` setup, build, install, and start commands for Linux and
  macOS, with Apple Silicon and Intel macOS CI coverage.
- A private Tailnet web deployment with live Serve/Funnel verification and the
  same bounded Bedrock helper and prose-review validation used by the desktop
  app.

[Unreleased]: https://github.com/avifenesh/trace-ml/commits/main
