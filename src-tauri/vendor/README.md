# Tauri opener compatibility patch

`tauri-plugin-opener` is vendored from crates.io release 2.7.2. Its MIT and
Apache-2.0 licenses are retained. The published crate checksum is recorded in
this README.

The stable Tauri 2 plugin requires zbus 5, which depends on the retired
zbus_names, zvariant, and zvariant_derive crates (RUSTSEC-2026-0371,
RUSTSEC-2026-0370, and RUSTSEC-2026-0372). The opener 3 prerelease requires
Tauri 3 and cannot replace the stable plugin in this application.

Local changes are limited to the zbus 6 dependency and its async file-reveal
API. The existing dedicated thread, URL-opening code, plugin commands,
permissions, and platform implementations are preserved. Remove this patch
when a stable Tauri 2 opener release provides the maintained D-Bus stack.

Upstream: https://github.com/tauri-apps/plugins-workspace/tree/44293a5722efcaf27060504e63b17aeba721b40f/plugins/opener

Published crate SHA-256: `53810be1b4fed22bb6ac3f4cab5a2b80d9391d1af436bda145607532bc0bb219`.
