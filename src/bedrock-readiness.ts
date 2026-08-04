export const BEDROCK_MODEL = "openai.gpt-5.6-sol";

export type BedrockRetentionMode =
  | "default"
  | "provider_data_share"
  | "none";

export interface BedrockReadiness {
  available: boolean;
  model: typeof BEDROCK_MODEL;
  retentionMode: BedrockRetentionMode;
  retentionSource: string;
  allowedRetentionModes: BedrockRetentionMode[];
}

const RETENTION_MODES = new Set<BedrockRetentionMode>([
  "default",
  "provider_data_share",
  "none",
]);

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

export function normalizeBedrockReadiness(
  value: unknown,
): BedrockReadiness | null {
  const readiness = objectRecord(value);
  if (
    !readiness ||
    typeof readiness.available !== "boolean" ||
    readiness.model !== BEDROCK_MODEL ||
    typeof readiness.retentionMode !== "string" ||
    !RETENTION_MODES.has(readiness.retentionMode as BedrockRetentionMode) ||
    typeof readiness.retentionSource !== "string" ||
    !readiness.retentionSource.trim() ||
    Array.from(readiness.retentionSource).length > 100 ||
    !Array.isArray(readiness.allowedRetentionModes) ||
    readiness.allowedRetentionModes.length === 0 ||
    !readiness.allowedRetentionModes.every(
      (mode) => typeof mode === "string" &&
        RETENTION_MODES.has(mode as BedrockRetentionMode),
    ) ||
    new Set(readiness.allowedRetentionModes).size !==
      readiness.allowedRetentionModes.length ||
    !readiness.allowedRetentionModes.includes(readiness.retentionMode)
  ) {
    return null;
  }

  return {
    available: readiness.available,
    model: BEDROCK_MODEL,
    retentionMode: readiness.retentionMode as BedrockRetentionMode,
    retentionSource: readiness.retentionSource.trim(),
    allowedRetentionModes:
      readiness.allowedRetentionModes as BedrockRetentionMode[],
  };
}

function retentionModeLabel(mode: BedrockRetentionMode) {
  switch (mode) {
    case "none":
      return "zero data retention";
    case "provider_data_share":
      return "provider data sharing permitted";
    case "default":
      return "model default";
  }
}

export function bedrockPolicySummary(readiness: BedrockReadiness) {
  return `Effective policy: ${retentionModeLabel(readiness.retentionMode)} (${readiness.retentionSource} setting).`;
}

export function bedrockPolicyDetails(readiness: BedrockReadiness) {
  const allowed = readiness.allowedRetentionModes
    .map(retentionModeLabel)
    .join(" and ");
  const verified = `Trace verified ${readiness.model}; this model allows ${allowed}.`;
  switch (readiness.retentionMode) {
    case "none":
      return `${verified} AWS describes zero data retention as no request or response data written to durable storage or shared with the model provider.`;
    case "provider_data_share":
      return `${verified} This effective mode permits provider data sharing and is not zero retention. AWS says classifier-flagged GPT-5.6 Sol traffic may be retained for up to 30 days for automated offline abuse detection.`;
    case "default":
      return `${verified} AWS says classifier-flagged GPT-5.6 Sol traffic may be retained for up to 30 days for automated offline abuse detection; setting store to false does not guarantee zero retention.`;
  }
}
