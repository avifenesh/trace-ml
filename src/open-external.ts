import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { MouseEvent } from "react";

export async function openExternalLink(
  event: MouseEvent<HTMLAnchorElement>,
  url: string,
) {
  if (!isTauri()) return true;

  event.preventDefault();
  try {
    await openUrl(url);
    return true;
  } catch {
    return false;
  }
}
