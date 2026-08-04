export function finishPythonOutput<T>(
  flush: (() => unknown) | undefined,
  finish: () => T,
) {
  try {
    flush?.();
  } catch {
    // Preserve the learner's original result if stream flushing fails.
  }
  return finish();
}
