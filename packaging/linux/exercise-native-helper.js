#!/usr/bin/env gjs

imports.gi.versions.Atspi = "2.0";
const Atspi = imports.gi.Atspi;
const GLib = imports.gi.GLib;
const System = imports.system;

const expectedPid = Number.parseInt(ARGV[0] ?? "", 10);
const timeoutSeconds = Number.parseInt(ARGV[1] ?? "30", 10);

if (
  !Number.isInteger(expectedPid) ||
  expectedPid <= 0 ||
  !Number.isInteger(timeoutSeconds) ||
  timeoutSeconds <= 0
) {
  printerr("Usage: exercise-native-helper.js PID TIMEOUT_SECONDS");
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
    // Defunct nodes are ignored while the webview updates.
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
    // Text is optional for accessible nodes.
  }
  return values.join(" ").replace(/\s+/g, " ").trim();
}

function descendants(root) {
  const result = [];
  const pending = [root];
  let visited = 0;
  while (pending.length > 0 && visited < 20_000) {
    const accessible = pending.pop();
    visited += 1;
    result.push(accessible);
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
  return result;
}

function applicationForPid() {
  const desktop = Atspi.get_desktop(0);
  const childCount = desktop.get_child_count();
  for (let index = 0; index < childCount; index += 1) {
    const application = desktop.get_child_at_index(index);
    if (!application) continue;
    try {
      if (application.get_process_id() === expectedPid) return application;
    } catch {
      // Applications can disappear while the desktop tree is read.
    }
  }
  return null;
}

function actionNamed(root, expectedName) {
  for (const accessible of descendants(root)) {
    try {
      if (accessible.get_name() !== expectedName) continue;
      const action = accessible.get_action_iface();
      if ((action?.get_n_actions() ?? 0) > 0) {
        return { accessible, action };
      }
    } catch {
      // Defunct or non-action nodes are skipped.
    }
  }
  return null;
}

function starterQuestion(root) {
  for (const accessible of descendants(root)) {
    try {
      const name = accessible.get_name() ?? "";
      if (
        !name.endsWith("?") ||
        accessible.get_role() !== Atspi.Role.PUSH_BUTTON
      ) {
        continue;
      }
      const action = accessible.get_action_iface();
      if ((action?.get_n_actions() ?? 0) > 0) {
        return { action, question: name };
      }
    } catch {
      // Defunct or non-action nodes are skipped.
    }
  }
  return null;
}

function transcript(root) {
  for (const accessible of descendants(root)) {
    try {
      if (accessible.get_name() === "Conversation messages") return accessible;
    } catch {
      // Defunct nodes are skipped.
    }
  }
  return null;
}

function transcriptMessages(root) {
  const result = [];
  let childCount = 0;
  try {
    childCount = root.get_child_count();
  } catch {
    return result;
  }
  for (let index = 0; index < childCount; index += 1) {
    try {
      const child = root.get_child_at_index(index);
      if (child) {
        result.push(
          descendants(child)
            .map(accessibleText)
            .filter((value) => value.length > 0)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        );
      }
    } catch {
      // The transcript can update between child count and retrieval.
    }
  }
  return result;
}

function responseAfterQuestion(messages, question) {
  const learnerIndex = messages.findIndex((message) =>
    message.includes(question)
  );
  if (learnerIndex < 0) return "";
  for (let index = learnerIndex + 1; index < messages.length; index += 1) {
    const message = messages[index] ?? "";
    if (
      message.trim().length > 0 &&
      !message.includes("Reading this page...") &&
      !message.includes("Cancelling...")
    ) {
      return message;
    }
  }
  return "";
}

const deadline = GLib.get_monotonic_time() + timeoutSeconds * 1_000_000;
let application = null;
let newConversation = null;

while (GLib.get_monotonic_time() < deadline) {
  application = applicationForPid();
  if (application) {
    newConversation = actionNamed(application, "New conversation");
    if (newConversation) break;
  }
  GLib.usleep(100_000);
}

if (!application || !newConversation) {
  Atspi.exit();
  printerr("The helper's New conversation action did not become available.");
  System.exit(1);
}

if (!newConversation.action.do_action(0)) {
  Atspi.exit();
  printerr("AT-SPI could not start an isolated helper conversation.");
  System.exit(1);
}

let questionAction = null;
while (GLib.get_monotonic_time() < deadline) {
  application = applicationForPid();
  if (application) {
    questionAction = starterQuestion(application);
    if (questionAction) break;
  }
  GLib.usleep(100_000);
}

if (!questionAction) {
  Atspi.exit();
  printerr("No authored starter question became available in the helper.");
  System.exit(1);
}

if (!questionAction.action.do_action(0)) {
  Atspi.exit();
  printerr("AT-SPI could not submit the authored helper question.");
  System.exit(1);
}

let response = "";
let observedMessages = [];
while (GLib.get_monotonic_time() < deadline) {
  application = applicationForPid();
  const messageLog = application ? transcript(application) : null;
  if (messageLog) {
    observedMessages = transcriptMessages(messageLog);
    response = responseAfterQuestion(
      observedMessages,
      questionAction.question,
    );
    if (response) break;
  }
  GLib.usleep(100_000);
}

Atspi.exit();
if (!response) {
  printerr(
    `The helper did not answer the submitted question: ${questionAction.question}`,
  );
  printerr(`Observed transcript children: ${JSON.stringify(observedMessages)}`);
  System.exit(1);
}

const responseSummary = response.replace(/\s+/g, " ").slice(0, 180);
print(`question="${questionAction.question}" response="${responseSummary}"`);
