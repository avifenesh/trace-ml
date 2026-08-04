#!/usr/bin/env gjs

imports.gi.versions.Atspi = "2.0";
const Atspi = imports.gi.Atspi;
const GLib = imports.gi.GLib;
const System = imports.system;

const expectedPid = Number.parseInt(ARGV[0] ?? "", 10);
const expectedName = ARGV[1] ?? "";
const timeoutSeconds = Number.parseInt(ARGV[2] ?? "30", 10);

if (
  !Number.isInteger(expectedPid) ||
  expectedPid <= 0 ||
  expectedName.length === 0 ||
  !Number.isInteger(timeoutSeconds) ||
  timeoutSeconds <= 0
) {
  printerr("Usage: find-native-control.js PID ACCESSIBLE_NAME TIMEOUT_SECONDS");
  System.exit(2);
}

if (Atspi.init() !== 0) {
  printerr("AT-SPI initialization failed.");
  System.exit(2);
}

function matchingCenter(root) {
  const pending = [root];
  let visited = 0;
  while (pending.length > 0 && visited < 20_000) {
    const accessible = pending.pop();
    visited += 1;

    try {
      if (accessible.get_name() === expectedName) {
        const component = accessible.get_component_iface();
        const extents = component?.get_extents(Atspi.CoordType.SCREEN);
        if (
          extents &&
          extents.x >= 0 &&
          extents.y >= 0 &&
          extents.width > 0 &&
          extents.height > 0
        ) {
          return [
            Math.floor(extents.x + extents.width / 2),
            Math.floor(extents.y + extents.height / 2),
          ];
        }
      }
    } catch {
      // Defunct accessibility nodes are ignored while the webview settles.
    }

    let childCount = 0;
    try {
      childCount = accessible.get_child_count();
    } catch {
      continue;
    }
    for (let index = childCount - 1; index >= 0; index -= 1) {
      try {
        const child = accessible.get_child_at_index(index);
        if (child) pending.push(child);
      } catch {
        // The DOM can change between child count and retrieval.
      }
    }
  }
  return null;
}

const deadline = GLib.get_monotonic_time() + timeoutSeconds * 1_000_000;
let sawApplication = false;

while (GLib.get_monotonic_time() < deadline) {
  const desktop = Atspi.get_desktop(0);
  const childCount = desktop.get_child_count();
  for (let index = 0; index < childCount; index += 1) {
    const application = desktop.get_child_at_index(index);
    if (!application) continue;
    try {
      if (application.get_process_id() !== expectedPid) continue;
    } catch {
      continue;
    }
    sawApplication = true;
    const center = matchingCenter(application);
    if (center) {
      print(`${center[0]} ${center[1]}`);
      Atspi.exit();
      System.exit(0);
    }
  }
  GLib.usleep(100_000);
}

Atspi.exit();
if (!sawApplication) {
  printerr(`Trace ML PID ${expectedPid} did not register with AT-SPI.`);
} else {
  printerr(
    `Accessible control "${expectedName}" did not become visible before timeout.`,
  );
}
System.exit(1);
