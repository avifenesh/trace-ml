# Repository Launch Checklist

Keep the GitHub repository private while completing this checklist. Changing
repository visibility is a separate, deliberate final action.

## Private Bring-Up

- Create `avifenesh/trace-ml` as a private repository and push `main`.
- Set the description to `An inspectable, evidence-led machine-learning course.`
- Add topics: `machine-learning`, `education`, `tauri`, `react`, `rust`, and
  `pyodide`.
- Enable issues, dependency alerts, and Dependabot security updates. Enable
  secret scanning and push protection where the account plan supports them.
- Disable the wiki and projects unless either has an active maintainer.
- Create the custom labels referenced by repository automation: `content`,
  `dependencies`, `javascript`, `rust`, and `github-actions`.
- After the first successful workflow run, protect `main` from force pushes and
  deletion. Require `Linux validation`, `Browser and Pyodide workflows`,
  `Linux package and installed app`, `macos-15`, and `macos-15-intel`. Private
  branch protection and CODEOWNERS enforcement require a supporting GitHub
  plan; if unavailable, record that blocker and apply them before going public.

## Validation While Private

- Require green `CI`, `macOS build`, and `Dependency audit` workflows.
- Confirm that GitHub's community profile recognizes the README, license,
  contribution guide, code of conduct, security policy, and issue templates.
- Check the CODEOWNERS file through GitHub's API and resolve every syntax or
  ownership error.
- Run `npm audit`, `cargo audit`, a full-history secret scan, and the repository
  quality gates.
- Review every RustSec informational warning. The current Tauri graph carries
  the accepted GTK3, `glib`, `proc-macro-error`, and `unic-*` warnings
  documented in `SECURITY.md`; recheck upstream replacements before each
  release.
- Review retained historical QA captures for credentials, private account
  data, learner data, and machine-specific paths before the first push.
- Clone into a fresh macOS checkout and prove `make doctor`, `make first-run`,
  relaunch by double-click, and `make smoke`.
- Repeat the source install and installed-app smoke on a supported Linux
  desktop.

## First Public Release

- Publish the initial release as source-only.
- Before attaching any desktop binary, generate and bundle the complete
  third-party license texts and copyright notices for the exact release
  artifacts. macOS binaries additionally require Developer ID signing and
  notarization.
- Move the shipped entries from `Unreleased` to a dated `0.1.0` section in
  `CHANGELOG.md`, then add `version: 0.1.0` and the same `date-released` to
  `CITATION.cff`.
- After all required workflows pass for the release commit, create the local
  signed annotated `v0.1.0` tag and run
  `TRACE_ML_REQUIRE_RELEASE_TAG=1 npm run check:metadata`.
- Push the verified tag without moving it to a different commit.
- Add a repository social preview derived from the current installed-app
  screenshot.
- Change visibility only after the release commit, fallback security email,
  branch rules, labels, and privately available security features are in place.

Immediately after making the repository public, enable private vulnerability
reporting, then verify the clone command, badges, issue forms, private
vulnerability form, citation link, and changelog links from a signed-out
browser.
