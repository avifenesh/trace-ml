SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help doctor setup web dev check test-e2e build install smoke start dmg first-run

help:
	@printf '%s\n' \
		'Trace ML commands:' \
		'  make doctor    Check desktop build prerequisites' \
		'  make setup     Install pinned dependencies and local runtime assets' \
		'  make web       Start the browser development server' \
		'  make dev       Start the Tauri desktop app in development' \
		'  make check     Run manifests, lint, types, unit tests, and Rust tests' \
		'  make test-e2e  Run the browser and real-Pyodide test suite' \
		'  make build     Build distributable bundles for this operating system' \
		'  make install   Verify, build, and install the native desktop app' \
		'  make smoke     Exercise the exact installed app and process' \
		'  make start     Open the installed desktop app' \
		'  make dmg       Build a macOS DMG on a Mac' \
		'  make first-run Run setup, install, and start in sequence'

doctor:
	@bash scripts/setup.sh --check

setup:
	@bash scripts/setup.sh

web:
	@npm run dev

dev:
	@npm run tauri dev

check:
	@npm run check:metadata
	@npm run check:manifests
	@npm run lint
	@npm run typecheck
	@npm test
	@cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
	@cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
	@cargo test --locked --manifest-path src-tauri/Cargo.toml

test-e2e:
	@npm run test:e2e

build:
	@npm run tauri -- build -- --locked

install:
	@bash scripts/install-desktop.sh

smoke:
	@bash scripts/smoke-installed-desktop.sh

start:
	@bash scripts/start-desktop.sh

dmg:
	@test "$$(uname -s)" = Darwin || { printf '%s\n' 'error: DMG bundles must be built on macOS' >&2; exit 1; }
	@npm run tauri -- build --bundles dmg -- --locked

first-run:
	@$(MAKE) setup
	@$(MAKE) install
	@$(MAKE) start
