#!/usr/bin/env gjs

imports.gi.versions.Atspi = "2.0";
const Atspi = imports.gi.Atspi;
const GLib = imports.gi.GLib;
const System = imports.system;

const expectedPid = Number.parseInt(ARGV[0] ?? "", 10);
const timeoutSeconds = Number.parseInt(ARGV[1] ?? "30", 10);
const requireBedrock = ARGV[2] === "--require-bedrock";
const readyText =
  "Your question, this page, and recent messages are sent to AWS Bedrock";
const localText = "Nothing is sent to Bedrock";

if (!Number.isInteger(expectedPid) || expectedPid <= 0) {
  printerr("A valid Trace ML process ID is required.");
  System.exit(2);
}

if (Atspi.init() !== 0) {
  printerr("AT-SPI initialization failed.");
  System.exit(2);
}

function accessibleText(accessible) {
  const values = [];
  try {
    const name = accessible.get_name();
    if (name) values.push(name);
  } catch {
    // Defunct accessibility nodes are ignored while the webview is settling.
  }
  try {
    const text = accessible.get_text_iface();
    const characterCount = text
      ? Atspi.Text.prototype.get_character_count.call(text)
      : 0;
    if (characterCount > 0) {
      values.push(
        Atspi.Text.prototype.get_text.call(text, 0, characterCount),
      );
    }
  } catch {
    // Not every accessible implements Text, and nodes can become defunct.
  }
  return values.join(" ").replace(/\s+/g, " ");
}

function findText(root, needle) {
  const pending = [root];
  let visited = 0;
  while (pending.length > 0 && visited < 20_000) {
    const accessible = pending.pop();
    visited += 1;
    if (accessibleText(accessible).includes(needle)) return true;
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
  return false;
}

const deadline = GLib.get_monotonic_time() + timeoutSeconds * 1_000_000;
let sawApplication = false;

while (GLib.get_monotonic_time() < deadline) {
  const desktop = Atspi.get_desktop(0);
  const childCount = desktop.get_child_count();
  for (let index = 0; index < childCount; index += 1) {
    const application = desktop.get_child_at_index(index);
    if (!application) continue;
    let applicationPid = 0;
    try {
      applicationPid = application.get_process_id();
    } catch {
      continue;
    }
    if (applicationPid !== expectedPid) continue;
    sawApplication = true;
    if (findText(application, readyText)) {
      print("Native lesson_helper_ready IPC reached semantic readiness.");
      Atspi.exit();
      System.exit(0);
    }
    if (findText(application, localText)) {
      if (requireBedrock) continue;
      print("local page helper reached native readiness");
      Atspi.exit();
      System.exit(0);
    }
  }
  GLib.usleep(250_000);
}

Atspi.exit();
if (!sawApplication) {
  printerr(
    `Trace ML PID ${expectedPid} did not register with AT-SPI. ` +
      "Ensure the GNOME accessibility bus is available.",
  );
} else if (requireBedrock) {
  printerr(
    "Trace ML reached the local fallback instead of native semantic readiness. " +
      "Check ~/.config/claude/bedrock.env and the bundled helper manifest.",
  );
} else {
  printerr("Trace ML remained pending before native semantic readiness.");
}
System.exit(1);
